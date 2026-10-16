const { EmbedBuilder } = require("discord.js");
const { MOD_LOG_CHANNEL_ID } = require("../moderation/config.js");

async function sendModLog(client, { action, target, moderator, reason, extra, category = "moderation" }) {
  const websiteUrl = (process.env.WEBSITE_AUDIT_URL || "").replace(/\/$/, "");
  const relaySecret = process.env.SLOTH_WEBHOOK_SECRET || "";
  if (websiteUrl && relaySecret) {
    try {
      const response = await fetch(websiteUrl + "/api/discord-log", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sloth-Webhook-Secret": relaySecret },
        body: JSON.stringify({
          category,
          actor: String(moderator?.id || moderator || "system"),
          actorName: String(moderator?.tag || moderator?.username || moderator || "System"),
          target: String(target?.id || target || ""),
          event: String(action || "moderation.action"),
          details: { reason: reason || "No reason provided", ...(extra ? { extra } : {}) }
        })
      });
      if (response.ok) return;
      console.warn("Haven Institute audit relay returned HTTP " + response.status);
    } catch (err) {
      console.warn("Haven Institute audit relay failed:", err.message);
    }
  }

  // Safe fallback while the website audit relay is not configured or unavailable.
  if (!MOD_LOG_CHANNEL_ID) return;
  try {
    const channel = await client.channels.fetch(MOD_LOG_CHANNEL_ID);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle(action || "Moderation action")
      .addFields(
        { name: "Target", value: String(target || "Unknown"), inline: true },
        { name: "Moderator", value: String(moderator || "System"), inline: true },
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
