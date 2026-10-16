const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { sendModLog } = require("../utils/modlog.js");

const DURATIONS = {
  "60s": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "10m": 10 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member for a set duration.")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) => o.setName("user").setDescription("Member to timeout").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("duration")
        .setDescription("How long")
        .setRequired(true)
        .addChoices(
          { name: "60 seconds", value: "60s" },
          { name: "5 minutes", value: "5m" },
          { name: "10 minutes", value: "10m" },
          { name: "1 hour", value: "1h" },
          { name: "1 day", value: "1d" },
          { name: "1 week", value: "1w" }
        )
    )
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("user");
    const durationKey = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason");
    const ms = DURATIONS[durationKey];

    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.editReply("Couldn't find that member in this server.");
      return;
    }

    try {
      await member.timeout(ms, reason);
    } catch (err) {
      await interaction.editReply(`Couldn't timeout this user: ${err.message}`);
      return;
    }

    await sendModLog(interaction.client, {
      action: "⏱️ Timeout",
      target: `${targetUser.tag} (${targetUser.id})`,
      moderator: `${interaction.user.tag}`,
      moderatorId: interaction.user.id,
      reason,
      extra: [{ name: "Duration", value: durationKey, inline: true }],
    });

    await interaction.editReply(`${targetUser.tag} has been timed out for ${durationKey}.`);
  },
};
