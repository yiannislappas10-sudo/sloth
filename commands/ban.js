const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { sendModLog } = require("../utils/modlog.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server.")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) => o.setName("user").setDescription("Member to ban").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    await interaction.deferReply();

    try {
      await interaction.guild.members.ban(targetUser.id, { reason });
    } catch (err) {
      await interaction.editReply(`Couldn't ban this user: ${err.message}`);
      return;
    }

    await sendModLog(interaction.client, {
      action: "🔨 Ban",
      target: `${targetUser.tag} (${targetUser.id})`,
      moderator: `${interaction.user.tag}`,
      moderatorId: interaction.user.id,
      reason,
    });

    await interaction.editReply(`${targetUser.tag} has been banned.`);
  },
};
