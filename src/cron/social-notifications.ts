import cron from "node-cron";
import { Bot } from "grammy";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { getShouts } from "../lastfm.js";
import { lastfmConfig } from "../config.js";
import { escapeHtml } from "../utils.js";

/** user row returned by the Last.fm-connected users query */
interface LastfmConnectedUser {
  userId: number;
  telegramId: bigint;
  serviceUsername: string;
}

/**
 * in-memory map from userId -> date string of the newest seen shout.
 * resets on restart, so the first poll after restart silently catches up
 * without flooding the user with old shouts.
 */
const lastSeenShoutDate = new Map<number, string>();

/**
 * fetch all users who have an active Last.fm connection with a known username
 */
async function fetchLastfmConnectedUsers(): Promise<LastfmConnectedUser[]> {
  const rows = await db
    .select({
      userId: users.id,
      telegramId: users.telegramId,
      serviceUsername: serviceConnections.serviceUsername,
    })
    .from(users)
    .innerJoin(serviceConnections, eq(serviceConnections.userId, users.id))
    .where(
      and(
        eq(serviceConnections.serviceType, "lastfm"),
        isNotNull(serviceConnections.serviceUsername)
      )
    );

  return rows
    .filter((row): row is LastfmConnectedUser => row.serviceUsername !== null);
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

          const newestShoutDate = shouts[0].date;
          const previouslySeen = lastSeenShoutDate.get(user.userId);

          if (!previouslySeen) {
            /** first poll — set baseline without sending to avoid flooding */
            lastSeenShoutDate.set(user.userId, newestShoutDate);
            continue;
          }

          const newShouts = shouts.filter(
            (shout) => shout.date > previouslySeen
          );

          for (const shout of newShouts) {
            await bot.api.sendMessage(
              String(user.telegramId),
              `\u{1F4E3} Shout from <b>${escapeHtml(shout.author)}</b>:\n${escapeHtml(shout.body)}`,
              { parse_mode: "HTML" }
            );
          }

          lastSeenShoutDate.set(user.userId, newestShoutDate);
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
