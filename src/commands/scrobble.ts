import { Composer, Context } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../schema.js";
import { extractTrackMetadata } from "../metadata.js";
import { submitScrobble } from "../scrobble-service.js";
import { t } from "../i18n/index.js";

const composer = new Composer<Context>();

/**
 * audio message handler — downloads the file, extracts ID3/Vorbis tags,
 * then scrobbles to all connected services & reports partial failures
 */
composer.on("message:audio", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("audio message received with no from field");
    return;
  }

  const lang = from.language_code ?? "en";
  const telegramId = BigInt(from.id);

  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  const user = userRow[0];
  if (!user) {
    await context.reply(t("common.connect_first", lang));
    return;
  }

  const telegramFile = await context.getFile();
  const fileUrl = `https://api.telegram.org/file/bot${context.api.token}/${telegramFile.file_path}`;

  let audioBuffer: Buffer;
  try {
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = Buffer.from(arrayBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`audio file download failed for telegramId=${from.id}: ${message}`);
    await context.reply(t("scrobble.download_failed", lang));
    return;
  }

  const mimeType = context.message.audio.mime_type;
  const metadata = await extractTrackMetadata(audioBuffer, mimeType);

  if (!metadata) {
    await context.reply(t("scrobble.no_tags", lang));
    return;
  }

  const { succeeded, failed } = await submitScrobble({
    userId: user.id,
    artist: metadata.artist,
    track: metadata.title,
    album: metadata.album ?? null,
    timestamp: Math.floor(Date.now() / 1000),
  });

  const hasSucceeded = succeeded.length > 0;
  const hasFailed = failed.length > 0;

  if (!hasSucceeded && !hasFailed) {
    await context.reply(t("scrobble.no_connections", lang));
    return;
  }

  if (!hasSucceeded && hasFailed) {
    await context.reply(t("scrobble.all_failed", lang, { failed: failed.join(", ") }));
    return;
  }

  await context.react("🎉");

  if (hasFailed) {
    await context.reply(t("scrobble.partial_failed", lang, { failed: failed.join(", ") }));
  }
});

export default composer;
