import { InputFile, InlineKeyboard } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { pendingScrobbles } from "./schema.js";

export interface ScrobbleableAudioParams {
  userId: number;
  artist: string;
  track: string;
  audioBuffer: Buffer;
  filename: string;
  caption: string;
  buttonLabel: string;
}

/**
 * callback that actually hands the audio to Telegram — either
 * `bot.api.sendAudio(chatId, ...)` for crons or `context.replyWithAudio(...)` for command handlers
 */
export type AudioSender = (
  audio: InputFile,
  options: {
    title: string;
    performer: string;
    caption: string;
    parse_mode: "HTML";
    reply_markup: InlineKeyboard;
  }
) => Promise<unknown>;

/**
 * insert a pending_scrobbles row, build the rec:{id} inline keyboard,
 * send the audio via the provided sender, and roll back the row if the send throws.
 * keeps the pending-row lifecycle and button wiring in one place for
 * both daily recommendations and /roulette.
 *
 * returns true on successful send. returns false only when the insert
 * produced no id (an unexpected DB edge case); throws when the send fails
 * after the helper has already cleaned up the orphaned row.
 */
export async function sendScrobbleableAudio(
  params: ScrobbleableAudioParams,
  send: AudioSender,
): Promise<boolean> {
  const { userId, artist, track, audioBuffer, filename, caption, buttonLabel } = params;

  const inserted = await db
    .insert(pendingScrobbles)
    .values({ userId, artist, track, album: null })
    .returning({ id: pendingScrobbles.id });

  const pendingRow = inserted[0];
  if (!pendingRow) {
    console.error(
      `sendScrobbleableAudio: pendingScrobbles insert returned no id for userId=${userId}`
    );
    return false;
  }

  const keyboard = new InlineKeyboard().text(buttonLabel, `rec:${pendingRow.id}`);

  try {
    await send(new InputFile(audioBuffer, filename), {
      title: track,
      performer: artist,
      caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return true;
  } catch (sendError) {
    try {
      await db.delete(pendingScrobbles).where(eq(pendingScrobbles.id, pendingRow.id));
    } catch (cleanupError) {
      console.error(
        `sendScrobbleableAudio: failed to clean up pendingScrobbles id=${pendingRow.id} after send failure`,
        cleanupError
      );
    }
    throw sendError;
  }
}
