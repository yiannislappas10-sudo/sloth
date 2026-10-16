require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Collection,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getDueUnbans, clearUnban } = require("./moderation/store.js");
const { OFFENSES } = require("./moderation/config.js");
const { getPending, deletePending } = require("./moderation/pending.js");
const { applyBypassBan, applyPointWarning } = require("./moderation/applyWarn.js");


const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function sendPrideEvent(interaction, eventName) {
  const baseUrl = (process.env.PRIDE_API_URL || "").replace(/\/$/, "");
  const key = process.env.PRIDE_API_KEY;
  if (!baseUrl || !key || !interaction.guildId) return;

  try {
    const response = await fetch(baseUrl + "/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pride-Key": key
      },
      body: JSON.stringify({
        guild_id: interaction.guildId,
        user_id: interaction.user.id,
        source_bot: "sloth",
        event: eventName,
        event_id: "sloth:" + interaction.id,
        metadata: { command: interaction.commandName }
      })
    });
    if (!response.ok) console.warn("Pride API returned HTTP " + response.status);
  } catch (error) {
    console.warn("Could not report event to Pride:", error.message);
  }
}

// Load slash commands from /commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Keep the target guild's slash-command list in sync with Sloth's
  // moderation commands. This also removes obsolete rules commands.
  if (process.env.GUILD_ID) {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const commandData = [...client.commands.values()].map((command) => command.data.toJSON());
      await guild.commands.set(commandData);
      console.log(`Synced ${commandData.length} moderation command(s) to GUILD_ID=${process.env.GUILD_ID}`);
    } catch (err) {
      console.error("Failed to sync guild commands:", err.message);
    }
  }

  processDueUnbans(); // catch up on anything missed while offline
  setInterval(processDueUnbans, 5 * 60 * 1000); // then check every 5 minutes
});

// Automatically lifts any 7-day bans (scheduled by /warn) once their time is up.
async function processDueUnbans() {
  const due = getDueUnbans();
  for (const entry of due) {
    try {
      const guild = await client.guilds.fetch(entry.guildId);
      await guild.members.unban(entry.userId, "7-day ban expired");
      console.log(`Auto-unbanned ${entry.userId} in guild ${entry.guildId}`);
    } catch (err) {
      console.error(`Failed to auto-unban ${entry.userId}:`, err.message);
    } finally {
      clearUnban(entry.guildId, entry.userId, entry.unbanAt);
    }
  }
}

client.on("interactionCreate", async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      void sendPrideEvent(interaction, "command:" + interaction.commandName);
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const requiredPermission = {
        ban: PermissionFlagsBits.BanMembers,
        hackban: PermissionFlagsBits.BanMembers,
        unban: PermissionFlagsBits.BanMembers,
        clearwarnings: PermissionFlagsBits.ModerateMembers,
        mute: PermissionFlagsBits.ModerateMembers,
        timeout: PermissionFlagsBits.ModerateMembers,
        unmute: PermissionFlagsBits.ModerateMembers,
        warn: PermissionFlagsBits.ModerateMembers,
        warnings: PermissionFlagsBits.ModerateMembers,
      }[interaction.commandName];

      if (requiredPermission && !interaction.memberPermissions?.has(requiredPermission)) {
        await interaction.reply({
          content: "You can see this command, but you do not have permission to use it.",

        });
        return;
      }

      await command.execute(interaction);
      return;
    }

    // /warn confirmation - "Yes, do it"
    if (interaction.isButton() && interaction.customId.startsWith("warn_confirm:")) {
      const token = interaction.customId.split(":")[1];
      const pendingAction = getPending(token);

      if (!pendingAction) {
        await interaction.reply({
          content: "This confirmation has expired. Please run /warn again.",

        });
        return;
      }
      deletePending(token);

      await interaction.deferUpdate();

      const guild = await client.guilds.fetch(pendingAction.guildId);
      const targetUser = await client.users.fetch(pendingAction.targetUserId);
      const offense = OFFENSES[pendingAction.offenseKey];

      let resultText;
      try {
        if (offense.bypass) {
          resultText = await applyBypassBan({
            client,
            guild,
            targetUser,
            offense,
            reason: pendingAction.reason,
            moderatorTag: pendingAction.moderatorTag,
          });
        } else {
          resultText = await applyPointWarning({
            client,
            guild,
            targetUser,
            offense,
            reason: pendingAction.reason,
            moderatorId: pendingAction.moderatorId,
            moderatorTag: pendingAction.moderatorTag,
          });
        }
      } catch (err) {
        resultText = `Something went wrong applying this action: ${err.message}`;
      }

      const container = new ContainerBuilder()
        .setAccentColor(0x000000)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# WARNING APPLIED"))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(resultText));

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    // /warn confirmation - "No, cancel"
    if (interaction.isButton() && interaction.customId.startsWith("warn_cancel:")) {
      const token = interaction.customId.split(":")[1];
      deletePending(token);

      const container = new ContainerBuilder()
        .setAccentColor(0x000000)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# CANCELLED"))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("No action was taken."));

      await interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }
  } catch (err) {
    console.error("Interaction error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Something went wrong. Please try again.",

      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);