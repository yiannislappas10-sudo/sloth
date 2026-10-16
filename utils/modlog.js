const { EmbedBuilder } = require("discord.js");
const { MOD_LOG_CHANNEL_ID } = require("../moderation/config.js");

async function sendModLog(client, { action, target, moderator, moderatorId, reason, extra, category }) {
  const actionText = String(action || "moderation.action");
  const resolvedCategory = category || (/warn|warning|point/i.test(actionText) ? "warnings" : "moderation");
  const targetText = String(target || "");
  const targetId = String(target?.id || targetText.match(/\d{17,20}/)?.[0] || targetText);
  const actorId = String(moderatorId || moderator?.id || moderator || "system");
  const actorName = String(moderator?.tag || moderator?.username || moderator || "System");
  const websiteUrl = (process.env.WEBSITE_AUDIT_URL || "").replace(/\/$/, "");
  const relaySecret = process.env.SLOTH_WEBHOOK_SECRET || "";
  if (websiteUrl && relaySecret) {
    try {
      const response = await fetch(websiteUrl + "/api/discord-log", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sloth-Webhook-Secret": relaySecret },
        body: JSON.stringify({
          category: resolvedCategory,
          actor: actorId,
          actorName,
          target: targetId,
          event: actionText,
          details: { reason: reason || "No reason provided", targetLabel: targetText, ...(extra ? { extra } : {}) }
        })
      });
      if (response.ok) return;
      console.warn("Haven Institute audit relay returned HTTP " + response.status);
    } catch (err) {
      console.warn("Haven Institute audit relay failed:", err.message);
    }
  }

  if (!MOD_LOG_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(MOD_LOG_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle(actionText)
      .addFields(
        { name: "Target", value: targetText || "Unknown", inline: true },
        { name: "Moderator", value: actorName + " (" + actorId + ")", inline: true },
        { name: "Reason", value: reason || "No reason provided" }
      )
      .setTimestamp();
    if (extra) embed.addFields(extra);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("Failed to send mod log:", err.message);
  }
}

module.exports = { sendModLog };
