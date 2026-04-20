import { Composer, Context, InputFile, InlineKeyboard } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { pendingScrobbles } from "../schema.js";
import { lastfmConfig } from "../config.js";
import { getLovedTracks, getTopTracks } from "../lastfm.js";
import { resolveLastfmConnection } from "../user-lookup.js";
import { downloadTrack } from "../yt-dlp.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";

const composer = new Composer<Context>();

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

  /** build a pool from loved tracks first, fall back to all-time top tracks */
  interface RouletteEntry {
    artist: string;
    track: string;
  }

  let pool: RouletteEntry[] = [];

  try {
    const lovedTracks = await getLovedTracks(lastfmConfig, serviceUsername, 100);
    pool = lovedTracks.map((entry) => ({ artist: entry.artist, track: entry.track }));
  } catch (lovedError) {
    console.warn(`roulette: loved tracks fetch failed for userId=${userId}`, lovedError);
  }

  if (!pool.length) {
    try {
      const topTracks = await getTopTracks(lastfmConfig, serviceUsername, "overall", 100);
      pool = topTracks
        .filter((entry) => entry.artist !== null)
        .map((entry) => ({ artist: entry.artist as string, track: entry.name }));
    } catch (topError) {
      console.warn(`roulette: top tracks fetch failed for userId=${userId}`, topError);
    }
  }

  if (!pool.length) {
    await context.api.deleteMessage(loadingMessage.chat.id, loadingMessage.message_id);
    await context.reply(t("roulette.empty", lang));
    return;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const { artist, track } = pick;

  const audioBuffer = await downloadTrack(artist, track);
  if (!audioBuffer) {
    await context.api.deleteMessage(loadingMessage.chat.id, loadingMessage.message_id);
    await context.reply(t("roulette.download_failed", lang));
    return;
  }

  /** insert pending row first so we have the id for the button callback_data */
  const pendingInsertResult = await db
    .insert(pendingScrobbles)
    .values({ userId, artist, track, album: null })
    .returning({ id: pendingScrobbles.id });

  const pendingRow = pendingInsertResult[0];
  if (!pendingRow) {
    console.error(
      `roulette: pendingScrobbles insert returned no id for userId=${userId} — aborting send`
    );
    await context.api.deleteMessage(loadingMessage.chat.id, loadingMessage.message_id);
    await context.reply(t("common.service_error", lang, { service: "the bot" }));
    return;
  }

  const keyboard = new InlineKeyboard().text(
    t("roulette.scrobble_button", lang),
    `rec:${pendingRow.id}`
  );

  const caption = t("roulette.caption", lang, {
    artist: escapeHtml(artist),
    track: escapeHtml(track),
  });

  try {
    await context.replyWithAudio(
      new InputFile(audioBuffer, `${artist} - ${track}.m4a`),
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
    console.warn(`roulette: audio send failed for userId=${userId} — cleaning up pending row`, sendError);
    try {
      await db.delete(pendingScrobbles).where(eq(pendingScrobbles.id, pendingRow.id));
    } catch (cleanupError) {
      console.error(
        `roulette: failed to clean up pendingScrobbles id=${pendingRow.id} after send failure`,
        cleanupError
      );
    }
    await context.api.deleteMessage(loadingMessage.chat.id, loadingMessage.message_id);
    return;
  }

  await context.api.deleteMessage(loadingMessage.chat.id, loadingMessage.message_id);
});

export default composer;
