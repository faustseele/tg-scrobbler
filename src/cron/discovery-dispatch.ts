import cron from "node-cron";
import { Bot, InputFile, InlineKeyboard } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { sentDiscoveries, pendingScrobbles } from "../schema.js";
import { fetchLastfmConnectedUsers, LastfmConnectedUser } from "../user-lookup.js";
import { getRecommendations } from "../recommendations.js";
import { downloadTrack } from "../yt-dlp.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";

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
    const lang = user.language ?? "en";
    const caption = t("discovery.caption", lang, {
      artist: escapeHtml(artist),
      track: escapeHtml(track),
    });

    /** insert pending row first so we have the id for the button callback_data */
    const pendingInsertResult = await db
      .insert(pendingScrobbles)
      .values({ userId: user.userId, artist, track, album: null })
      .returning({ id: pendingScrobbles.id });

    const pendingRow = pendingInsertResult[0];
    if (!pendingRow) {
      console.error(
        `discovery dispatch: pendingScrobbles insert returned no id for userId=${user.userId} — skipping send`
      );
      continue;
    }

    const keyboard = new InlineKeyboard().text(
      t("recommendation.scrobble_button", lang),
      `rec:${pendingRow.id}`
    );

    try {
      await bot.api.sendAudio(
        String(user.telegramId),
        new InputFile(audioBuffer, filename),
        {
          title: track,
          performer: artist,
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } catch (sendError) {
      /** clean up orphaned pending row when send fails */
      try {
        await db.delete(pendingScrobbles).where(eq(pendingScrobbles.id, pendingRow.id));
      } catch (cleanupError) {
        console.error(
          `discovery dispatch: failed to clean up pendingScrobbles id=${pendingRow.id} after send failure`,
          cleanupError
        );
      }
      throw sendError;
    }

    await db.insert(sentDiscoveries).values({ userId: user.userId, trackKey });

    return;
  }

  console.warn(
    `discovery dispatch: all ${candidates.length} candidates failed for userId=${user.userId} — skipping this cycle`
  );
}

/**
 * register the discovery dispatch cron job. fires daily at 09:00 UTC.
 * fetches all users with a Last.fm connection, picks the first downloadable recommendation,
 * and sends it as an audio message. per-user failures are caught individually
 * so one bad dispatch doesn't abort the rest.
 */
export function startDiscoveryDispatchCron(bot: Bot): void {
  cron.schedule(
    "0 9 * * *",
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
