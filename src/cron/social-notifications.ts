import cron from "node-cron";
import { Bot } from "grammy";
import { getShouts } from "../lastfm.js";
import { lastfmConfig } from "../config.js";
import { escapeHtml } from "../utils.js";
import { fetchLastfmConnectedUsers, LastfmConnectedUser } from "../user-lookup.js";
import { t } from "../i18n/index.js";

/**
 * in-memory map from userId -> unix timestamp (ms) of the newest seen shout.
 * resets on restart, so the first poll after restart silently catches up
 * without flooding the user with old shouts.
 */
const lastSeenShoutTimestamp = new Map<number, number>();

/** parse a Last.fm date string to unix ms — returns 0 if unparseable */
function parseShoutDate(dateString: string): number {
  const parsed = Date.parse(dateString);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * register the social notifications cron job.
 * fires every 6 hours at minute 0 (UTC), polls each Last.fm-connected user's
 * shout wall, and forwards any new shouts to their Telegram chat.
 * per-user failures are caught individually so one bad fetch doesn't
 * abort the rest of the run.
 */
export function startSocialNotificationsCron(bot: Bot): void {
  cron.schedule(
    "0 */6 * * *",
    async () => {
      let connectedUsers: LastfmConnectedUser[];
      try {
        connectedUsers = await fetchLastfmConnectedUsers();
      } catch (error) {
        console.error("social notifications: failed to fetch connected users", error);
        return;
      }

      for (const user of connectedUsers) {
        try {
          const shouts = await getShouts(lastfmConfig, user.serviceUsername, 5);
          if (!shouts.length) continue;

          const newestTimestamp = parseShoutDate(shouts[0].date);
          const previouslySeen = lastSeenShoutTimestamp.get(user.userId);

          if (previouslySeen === undefined) {
            /** first poll — set baseline without sending to avoid flooding */
            lastSeenShoutTimestamp.set(user.userId, newestTimestamp);
            continue;
          }

          const newShouts = shouts.filter(
            (shout) => parseShoutDate(shout.date) > previouslySeen
          );

          const lang = user.language ?? "en";

          for (const shout of newShouts) {
            const notification = t("shout.notification", lang, {
              author: escapeHtml(shout.author),
              body: escapeHtml(shout.body),
            });
            await bot.api.sendMessage(
              String(user.telegramId),
              `${notification}\n${escapeHtml(shout.body)}`,
              { parse_mode: "HTML" }
            );
          }

          lastSeenShoutTimestamp.set(user.userId, newestTimestamp);
        } catch (error) {
          console.error(
            `social notifications: failed to process user ${user.telegramId}`,
            error
          );
        }
      }
    },
    { timezone: "UTC" }
  );
}
