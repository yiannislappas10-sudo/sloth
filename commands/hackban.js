const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { sendModLog } = require("../utils/modlog.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hackban")
    .setDescription("Ban a user by ID, even if they're not currently in the server.")
    .setDefaultMemberPermissions(null)
    .addStringOption((o) => o.setName("userid").setDescription("The user's Discord ID").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(interaction) {
    const userId = interaction.options.getString("userid");
    const reason = interaction.options.getString("reason");

    await interaction.deferReply();

    if (!/^\d{15,25}$/.test(userId)) {
      await interaction.editReply("That doesn't look like a valid Discord user ID.");
      return;
    }

    try {
      await interaction.guild.members.ban(userId, { reason });
    } catch (err) {
      await interaction.editReply(`Couldn't hackban this ID: ${err.message}`);
      return;
    }

    await sendModLog(interaction.client, {
      action: "🔨 Hackban",
      target: `<@${userId}> (${userId})`,
      moderator: `${interaction.user.tag}`,
      moderatorId: interaction.user.id,
      reason,
    });

    await interaction.editReply(`User ID \`${userId}\` has been hackbanned.`);
  },
};
