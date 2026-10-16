// ============================================================
// EDIT THESE TO MATCH YOUR SERVER'S ROLE/CHANNEL IDS AND RULES.
// Right-click a role or channel in Discord (Developer Mode on) -> Copy ID.
// ============================================================

// Where every mod command logs its action. Set this as an env var
// (MOD_LOG_CHANNEL_ID) in Railway, or hardcode it here.
module.exports.MOD_LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || "";

// Role used by /mute and /unmute. Must exist in your server already,
// with permission overwrites set up to actually silence people.
module.exports.MUTED_ROLE_ID = process.env.MUTED_ROLE_ID || "";

// Offense type -> points added when /warn is used with that option.
// "bypass" offenses skip the point ladder entirely and act immediately.
module.exports.OFFENSES = {
  minor: { label: "Minor rule break", points: 1 },
  repeated_minor: { label: "Repeated minor breaks", points: 2 },
  moderate: { label: "Moderate offense", points: 3 },
  serious: { label: "Serious offense", points: 5 },
  extreme: { label: "Extreme offense", points: null, bypass: "immediate_ban" },
  evasion: { label: "Ban evasion / repeat ban", points: null, bypass: "permanent_ban" },
};

// After adding points, the user's NEW TOTAL is checked against this list
// top to bottom — the first (highest) threshold their total meets or
// beats is the action taken. Keep this sorted highest points first.
module.exports.THRESHOLDS = [
  { points: 6, action: "temp_ban", durationMs: 7 * 24 * 60 * 60 * 1000, label: "7-day ban" },
  { points: 5, action: "timeout", durationMs: 7 * 24 * 60 * 60 * 1000, label: "7-day timeout" },
  { points: 3, action: "timeout", durationMs: 24 * 60 * 60 * 1000, label: "24-hour timeout" },
  { points: 2, action: "written_warning", label: "Written warning" },
  { points: 1, action: "verbal_warning", label: "Verbal warning" },
];
