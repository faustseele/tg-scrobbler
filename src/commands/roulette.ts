import { Composer, Context } from "grammy";
import { lastfmConfig } from "../config.js";
import { getLovedTracks, getTopTracks } from "../lastfm.js";
import { resolveLastfmConnection } from "../user-lookup.js";
import { downloadTrack } from "../yt-dlp.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";
import { sendScrobbleableAudio } from "../scrobble-delivery.js";

const composer = new Composer<Context>();

/** one candidate in the roulette pool — artist+track only, since the pool discards Last.fm metadata */
interface RouletteEntry {
  artist: string;
  track: string;
}

/**
 * build the roulette candidate pool. loved tracks first (the user's curated favourites),
 * falling back to their all-time top tracks when the loved list is empty or unreachable.
 */
async function buildPool(userId: number, serviceUsername: string): Promise<RouletteEntry[]> {
  try {
    const lovedTracks = await getLovedTracks(lastfmConfig, serviceUsername, 100);
    if (lovedTracks.length) {
      return lovedTracks.map((entry) => ({ artist: entry.artist, track: entry.track }));
    }
  } catch (lovedError) {
    console.warn(`roulette: loved tracks fetch failed for userId=${userId}`, lovedError);
  }

  try {
    const topTracks = await getTopTracks(lastfmConfig, serviceUsername, "overall", 100);
    return topTracks
      .filter((entry) => entry.artist !== null)
      .map((entry) => ({ artist: entry.artist as string, track: entry.name }));
  } catch (topError) {
    console.warn(`roulette: top tracks fetch failed for userId=${userId}`, topError);
    return [];
  }
}

/**
 * /roulette — pick a random track from the user's loved or top tracks,
 * download it, and send it as audio with a "Scrobble again" button
 */
composer.command("roulette", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("/roulette received with no from field");
    return;
  }

  const lang = from.language_code ?? "en";
  const connection = await resolveLastfmConnection(BigInt(from.id));
  if (!connection) {
    await context.reply(t("common.no_lastfm", lang));
    return;
  }

  const { userId, serviceUsername } = connection;

  const loadingMessage = await context.reply(t("roulette.loading", lang));
  const deleteLoadingMessage = (): Promise<unknown> =>
    context.api.deleteMessage(loadingMessage.chat.id, loadingMessage.message_id);

  const pool = await buildPool(userId, serviceUsername);
  if (!pool.length) {
    await deleteLoadingMessage();
    await context.reply(t("roulette.empty", lang));
    return;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const { artist, track } = pick;

  const audioBuffer = await downloadTrack(artist, track);
  if (!audioBuffer) {
    await deleteLoadingMessage();
    await context.reply(t("roulette.download_failed", lang));
    return;
  }

  const caption = t("roulette.caption", lang, {
    artist: escapeHtml(artist),
    track: escapeHtml(track),
  });

  try {
    const sent = await sendScrobbleableAudio(
      {
        userId,
        artist,
        track,
        audioBuffer,
        filename: `${artist} - ${track}.m4a`,
        caption,
        buttonLabel: t("roulette.scrobble_button", lang),
      },
      (audio, options) => context.replyWithAudio(audio, options),
    );
    if (!sent) {
      await deleteLoadingMessage();
      await context.reply(t("common.service_error", lang, { service: "the bot" }));
      return;
    }
  } catch (sendError) {
    /** helper already logged + cleaned up the pending row */
    console.warn(`roulette: audio send failed for userId=${userId}`, sendError);
    await deleteLoadingMessage();
    return;
  }

  await deleteLoadingMessage();
});

export default composer;
