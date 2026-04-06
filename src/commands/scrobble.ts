import { Composer, Context } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { extractTrackMetadata } from "../metadata.js";

const composer = new Composer<Context>();

/**
 * audio message handler — downloads the file, extracts ID3/Vorbis tags,
 * and echoes artist/title/album back to the user.
 * actual scrobble submission to external services happens later.
 */
composer.on("message:audio", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("audio message received with no from field");
    return;
  }

  const telegramId = BigInt(from.id);

  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  const user = userRow[0];
  if (!user) {
    await context.reply(
      "Connect a service first with /login_lastfm, /login_librefm, or /login_listenbrainz"
    );
    return;
  }

  const connections = await db
    .select({ id: serviceConnections.id })
    .from(serviceConnections)
    .where(eq(serviceConnections.userId, user.id))
    .limit(1);

  if (!connections.length) {
    await context.reply(
      "Connect a service first with /login_lastfm, /login_librefm, or /login_listenbrainz"
    );
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
    await context.reply("Couldn't download the audio file. Try again in a moment.");
    return;
  }

  const mimeType = context.message.audio.mime_type;
  const metadata = await extractTrackMetadata(audioBuffer, mimeType);

  if (!metadata) {
    await context.reply(
      "Couldn't read tags from this file. Make sure it has artist and title metadata."
    );
    return;
  }

  await context.react("🎉");

  const albumSuffix = metadata.album ? ` [${metadata.album}]` : "";
  await context.reply(`${metadata.artist} — ${metadata.title}${albumSuffix}`);
});

export default composer;
