const { SlashCommandBuilder } = require("discord.js");
const { JAILED_ROLE_ID, JAIL_CHANNEL_ID } = require("../moderation/config.js");
const { getJailState, clearJailState } = require("../moderation/store.js");
const { sendModLog } = require("../utils/modlog.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unjail")
    .setDescription("Restore a member's previous roles and remove jail restrictions.")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) => o.setName("user").setDescription("Member to unjail").setRequired(true)),

  async execute(interaction) {
    if (!JAILED_ROLE_ID || !JAIL_CHANNEL_ID) {
      await interaction.reply({
        content: "JAILED_ROLE_ID and JAIL_CHANNEL_ID must be configured before using /unjail.",
      });
      return;
    }

    const targetUser = interaction.options.getUser("user");
    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const me = interaction.guild.members.me;
    if (!member || !me) {
      await interaction.editReply("Couldn't find that member or the bot member.");
      return;
    }

    const state = getJailState(interaction.guild.id, member.id);

    try {
      // Always remove the jailed role first.
      // This guarantees the member is no longer marked as jailed after /unjail.
      if (member.roles.cache.has(JAILED_ROLE_ID)) {
        await member.roles.remove(JAILED_ROLE_ID, "Member unjailed");
      }

      // Restore every old role saved by /jail.
      // Roles that no longer exist, are managed, or are above the bot are skipped.
      if (state?.roleIds?.length) {
        const roles = await Promise.all(
          state.roleIds.map((id) => interaction.guild.roles.fetch(id).catch(() => null))
        );

        const restorableRoles = roles.filter(
          (role) =>
            role &&
            !role.managed &&
            role.id !== interaction.guild.id &&
            role.position < me.roles.highest.position
        );

        const blockedRoles = roles.filter(
          (role) =>
            role &&
            !role.managed &&
            role.id !== interaction.guild.id &&
            role.position >= me.roles.highest.position
        );

        if (restorableRoles.length) {
          await member.roles.add(restorableRoles, "Restore roles after jail");
        }

        if (blockedRoles.length) {
          throw new Error(
            `I restored the roles I can manage, but these saved roles are above my highest role: ${blockedRoles.map((r) => r.name).join(", ")}. Move Sloth's role above them and run /unjail again.`
          );
        }
      }

      // Remove the jail-specific member overwrites concurrently.
      const channels = await interaction.guild.channels.fetch();
      const removals = [];

      for (const channel of channels.values()) {
        if (!channel?.isTextBased() || !channel.permissionOverwrites) continue;

        // Only delete an overwrite if this jail command created one.
        if (channel.permissionOverwrites.cache.has(member.id)) {
          removals.push(
            channel.permissionOverwrites.delete(
              member.id,
              "Remove jail channel restrictions"
            )
          );
        }
      }

      await Promise.all(removals);

      // Only clear the saved snapshot after roles and restrictions were restored.
      clearJailState(interaction.guild.id, member.id);
    } catch (err) {
      await interaction.editReply(`Couldn't unjail this user completely: ${err.message}`);
      return;
    }

    void sendModLog(interaction.client, {
      action: "Unjail",
      target: `${targetUser.tag} (${targetUser.id})`,
      moderator: `${interaction.user.tag}`,
      reason: "—",
    }).catch((err) => console.error("Unjail mod-log failed:", err));

    const restoreNote = state
      ? "their saved roles were restored"
      : "no saved role snapshot was found, so roles must be restored manually";

    await interaction.editReply(
      `${targetUser.tag} has been unjailed; ${restoreNote} and the Jailed role was removed.`
    );
  },
};
