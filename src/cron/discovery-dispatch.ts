import cron from "node-cron";
import { Bot, InputFile } from "grammy";
import { db } from "../db.js";
import { sentDiscoveries } from "../schema.js";
import { fetchLastfmConnectedUsers, LastfmConnectedUser } from "../user-lookup.js";
import { getRecommendations } from "../recommendations.js";
import { downloadTrack } from "../yt-dlp.js";
import { escapeHtml } from "../utils.js";

/**
 * attempt to download and send the first successful recommendation for a user.
 * iterates candidates in order, stops as soon as one is sent.
 * inserts into sent_discoveries to prevent re-sending.
 */
async function dispatchForUser(bot: Bot, user: LastfmConnectedUser): Promise<void> {
  const candidates = await getRecommendations(user.userId, user.serviceUsername, 5);

  if (!candidates.length) {
    console.warn(`discovery dispatch: no candidates for userId=${user.userId}`);
    return;
  }

  for (const candidate of candidates) {
    const { artist, track } = candidate;
    const audioBuffer = await downloadTrack(artist, track);

    if (!audioBuffer) {
      console.warn(
        `discovery dispatch: download miss — "${artist} - ${track}" for userId=${user.userId}`
      );
      continue;
    }

    const trackKey = `${artist.toLowerCase()} - ${track.toLowerCase()}`;
    const filename = `${artist} - ${track}.m4a`;
    const caption = `\u{1F3B5} Discovery: <b>${escapeHtml(artist)}</b> \u2014 ${escapeHtml(track)}`;

    await bot.api.sendAudio(
      String(user.telegramId),
      new InputFile(audioBuffer, filename),
      {
        title: track,
        performer: artist,
        caption,
        parse_mode: "HTML",
      }
    );

    await db.insert(sentDiscoveries).values({ userId: user.userId, trackKey });

    return;
  }

  console.warn(
    `discovery dispatch: all ${candidates.length} candidates failed for userId=${user.userId} — skipping this cycle`
  );
}

/**
 * register the discovery dispatch cron job. fires Wednesday and Saturday at 10:00 UTC.
 * fetches all users with a Last.fm connection, picks the first downloadable recommendation,
 * and sends it as an audio message. per-user failures are caught individually
 * so one bad dispatch doesn't abort the rest.
 */
export function startDiscoveryDispatchCron(bot: Bot): void {
  cron.schedule(
    "0 10 * * 3,6",
    async () => {
      let lastfmUsers: LastfmConnectedUser[];
      try {
        lastfmUsers = await fetchLastfmConnectedUsers();
      } catch (error) {
        console.error("discovery dispatch: failed to fetch Last.fm users", error);
        return;
      }

      for (const user of lastfmUsers) {
        try {
          await dispatchForUser(bot, user);
        } catch (error) {
          console.error(
            `discovery dispatch: failed for userId=${user.userId} (telegramId=${user.telegramId})`,
            error
          );
        }
      }
    },
    { timezone: "UTC" }
  );
}
