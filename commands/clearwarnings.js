const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { resetUser } = require("../moderation/store.js");
const { sendModLog } = require("../utils/modlog.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Reset a member's warning points and history to zero.")
    .setDefaultMemberPermissions(null)
    .addUserOption((o) => o.setName("user").setDescription("Member to clear").setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("user");
    resetUser(interaction.guild.id, targetUser.id);

    await sendModLog(interaction.client, {
      action: "🧹 Warnings Cleared",
      target: `${targetUser.tag} (${targetUser.id})`,
      moderator: `${interaction.user.tag}`,
      moderatorId: interaction.user.id,
      reason: "—",
    });

    await interaction.reply({
      content: `${targetUser.tag}'s warning points have been reset to 0.`,

    });
  },
};
