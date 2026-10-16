const { getActionForPoints } = require("./escalate.js");
const { addWarning, scheduleUnban } = require("./store.js");
const { sendModLog } = require("../utils/modlog.js");

// Extreme / evasion offenses - bypass the point ladder, ban immediately.
async function applyBypassBan({ client, guild, targetUser, offense, reason, moderatorId, moderatorTag }) {
  const permanent = offense.bypass === "permanent_ban";
  await guild.members.ban(targetUser.id, { reason: `${offense.label}: ${reason}` });

  await sendModLog(client, {
    action: permanent ? "🔨 Permanent Ban" : "🔨 Immediate Ban",
    target: `${targetUser.tag} (${targetUser.id})`,
    moderator: moderatorTag,
    moderatorId,
    reason,
  });

  return `${targetUser.tag} has been ${permanent ? "permanently" : "immediately"} banned.`;
}

// Normal point-based path - adds points, applies whatever the new total's
// escalation tier calls for, DMs the user, and logs it.
async function applyPointWarning({ client, guild, targetUser, offense, reason, moderatorId, moderatorTag }) {
  const member = await guild.members.fetch(targetUser.id).catch(() => null);

  const record = addWarning(guild.id, targetUser.id, {
    offense: offense.label,
    points: offense.points,
    reason,
    moderatorId,
    timestamp: Date.now(),
  });

  const tier = getActionForPoints(record.points);
  let actionTaken = "No automatic action (below first threshold).";

  if (tier) {
    if (tier.action === "timeout" && member) {
      try {
        await member.timeout(tier.durationMs, reason);
        actionTaken = tier.label;
      } catch (err) {
        actionTaken = `${tier.label} (failed to apply: ${err.message})`;
      }
    } else if (tier.action === "temp_ban") {
      try {
        await guild.members.ban(targetUser.id, { reason: `${tier.label}: ${reason}` });
        scheduleUnban(guild.id, targetUser.id, Date.now() + tier.durationMs);
        actionTaken = tier.label;
      } catch (err) {
        actionTaken = `${tier.label} (failed to apply: ${err.message})`;
      }
    } else {
      actionTaken = tier.label; // verbal_warning / written_warning - notice only
    }
  }

  if (member) {
    await member
      .send(
        `You've received a warning in **${guild.name}**.\n` +
          `**Offense:** ${offense.label}\n**Reason:** ${reason}\n` +
          `**Total points:** ${record.points}\n**Action:** ${actionTaken}`
      )
      .catch(() => {});
  }

  await sendModLog(client, {
    action: `⚠️ Warning — ${offense.label}`,
    target: `${targetUser.tag} (${targetUser.id})`,
    moderator: moderatorTag,
    reason,
    extra: [
      { name: "Points added", value: `${offense.points}`, inline: true },
      { name: "Total points", value: `${record.points}`, inline: true },
      { name: "Action taken", value: actionTaken },
    ],
  });

  return `Warned ${targetUser.tag}. Total points: **${record.points}**. Action taken: **${actionTaken}**.`;
}

module.exports = { applyBypassBan, applyPointWarning };
