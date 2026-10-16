// ============================================================
// Simple JSON-file storage. Points and history live here.
//
// IMPORTANT: Railway wipes the container's filesystem on every
// redeploy UNLESS a Volume is attached. Set DATA_FILE (env var) to a
// path inside that volume, e.g. /data/moderation.json, or this file
// (and everyone's warning history) resets every time you push code.
// ============================================================
const fs = require("fs");
const path = require("path");

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "..", "data", "moderation.json");

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { users: {}, scheduledUnbans: [] };
  }
}

function save(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUser(guildId, userId) {
  const data = load();
  const key = `${guildId}:${userId}`;
  return data.users[key] || { points: 0, history: [] };
}

// Adds points + a history entry, returns the user's updated record.
function addWarning(guildId, userId, entry) {
  const data = load();
  const key = `${guildId}:${userId}`;
  if (!data.users[key]) data.users[key] = { points: 0, history: [] };
  data.users[key].points += entry.points || 0;
  data.users[key].history.push(entry);
  save(data);
  return data.users[key];
}

function resetUser(guildId, userId) {
  const data = load();
  const key = `${guildId}:${userId}`;
  delete data.users[key];
  save(data);
}

function scheduleUnban(guildId, userId, unbanAt) {
  const data = load();
  data.scheduledUnbans.push({ guildId, userId, unbanAt });
  save(data);
}

function getDueUnbans(now = Date.now()) {
  const data = load();
  return data.scheduledUnbans.filter((u) => u.unbanAt <= now);
}

function clearUnban(guildId, userId, unbanAt) {
  const data = load();
  data.scheduledUnbans = data.scheduledUnbans.filter(
    (u) => !(u.guildId === guildId && u.userId === userId && u.unbanAt === unbanAt)
  );
  save(data);
}

module.exports = { getUser, addWarning, resetUser, scheduleUnban, getDueUnbans, clearUnban };
