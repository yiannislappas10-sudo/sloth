const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { MUTED_ROLE_ID } = require("../moderation/config.js");
const { sendModLog } = require("../utils/modlog.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Give a member the Muted role (indefinite, until /unmute).")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) => o.setName("user").setDescription("Member to mute").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(interaction) {
    if (!MUTED_ROLE_ID) {
      await interaction.reply({
        content: "MUTED_ROLE_ID isn't set yet — add it as an env var or in moderation/config.js.",

      });
      return;
    }

    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.editReply("Couldn't find that member in this server.");
      return;
    }

    try {
      await member.roles.add(MUTED_ROLE_ID, reason);
    } catch (err) {
      await interaction.editReply(`Couldn't mute this user: ${err.message}`);
      return;
    }

    await sendModLog(interaction.client, {
      action: "🔇 Mute",
      target: `${targetUser.tag} (${targetUser.id})`,
      moderator: `${interaction.user.tag}`,
      moderatorId: interaction.user.id,
      reason,
    });

    await interaction.editReply(`${targetUser.tag} has been muted.`);
  },
};
