import { Composer, Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, pendingScrobbles } from "../schema.js";
import { submitScrobble } from "../scrobble-service.js";
import { t } from "../i18n/index.js";

const REC_CALLBACK_PATTERN = /^rec:(\d+)$/;

/**
 * grammY Composer that handles the "Scrobble this" button on discovery audio messages.
 * matches callback_data of the form `rec:{pendingScrobbleId}`.
 */
const scrobbleCallback = new Composer<Context>();

/**
 * append a final line to the audio caption, strip the inline keyboard,
 * and dismiss the button's loading spinner. both success and failure
 * paths end with this — extracting it keeps the handler's branches terse
 */
async function editCaptionAndDismiss(context: Context, suffixLine: string): Promise<void> {
  const cbq = context.callbackQuery;
  const message = cbq?.message;
  const chatId = message?.chat.id;
  const messageId = message?.message_id;

  const baseCaption = message && "caption" in message ? (message.caption ?? "") : "";
  const updatedCaption = `${baseCaption}\n\n${suffixLine}`;

  if (chatId && messageId) {
    try {
      await context.api.editMessageCaption(chatId, messageId, {
        caption: updatedCaption,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      });
    } catch (editError) {
      /** message may be too old to edit — not critical, caller already completed the scrobble */
      console.warn(`scrobble-callback: could not edit caption for messageId=${messageId}`, editError);
    }
  }

  await context.answerCallbackQuery();
}

scrobbleCallback.callbackQuery(REC_CALLBACK_PATTERN, async (context) => {
  const lang = context.from?.language_code ?? "en";
  const pendingId = parseInt(context.match[1], 10);

  /** resolve caller → internal user id; needed for the ownership probe below */
  let callerId: number | undefined;
  try {
    const callerRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.telegramId, BigInt(context.from.id)))
      .limit(1);

    callerId = callerRows[0]?.id;
  } catch (lookupError) {
    console.error(`scrobble-callback: failed to look up caller telegramId=${context.from.id}`, lookupError);
    await context.answerCallbackQuery({ text: t("common.service_error", lang, { service: "the bot" }) });
    return;
  }

  if (!callerId) {
    /** user somehow hit a button before a users row was ever created for them */
    await context.answerCallbackQuery({ text: t("recommendation.not_yours", lang) });
    return;
  }

  /** atomically claim the row — DELETE + WHERE ownership + RETURNING
   *  avoids the check-then-delete race where two near-simultaneous clicks
   *  could both read the row and both call submitScrobble before either deletes */
  let claimed:
    | { artist: string; track: string; album: string | null }
    | undefined;
  try {
    const claimedRows = await db
      .delete(pendingScrobbles)
      .where(
        and(
          eq(pendingScrobbles.id, pendingId),
          eq(pendingScrobbles.userId, callerId),
        ),
      )
      .returning({
        artist: pendingScrobbles.artist,
        track: pendingScrobbles.track,
        album: pendingScrobbles.album,
      });
    claimed = claimedRows[0];
  } catch (claimError) {
    console.error(`scrobble-callback: failed to claim pendingScrobbles id=${pendingId}`, claimError);
    await context.answerCallbackQuery({ text: t("common.service_error", lang, { service: "the bot" }) });
    return;
  }

  if (!claimed) {
    /** nothing deleted — row is gone (already scrobbled by another click) or never belonged to this caller.
     *  probe to distinguish so the toast is accurate; any error here falls back to the "already scrobbled" message */
    let ownerRow: { userId: number } | undefined;
    try {
      const probe = await db
        .select({ userId: pendingScrobbles.userId })
        .from(pendingScrobbles)
        .where(eq(pendingScrobbles.id, pendingId))
        .limit(1);
      ownerRow = probe[0];
    } catch (probeError) {
      console.warn(`scrobble-callback: ownership probe failed for id=${pendingId}`, probeError);
    }

    if (ownerRow && ownerRow.userId !== callerId) {
      await context.answerCallbackQuery({ text: t("recommendation.not_yours", lang) });
      return;
    }

    /** row was already consumed — silence the stale button */
    try {
      await context.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    } catch {
      /** message may be too old to edit — non-critical */
    }
    await context.answerCallbackQuery({ text: t("recommendation.already_scrobbled", lang) });
    return;
  }

  const { artist, track, album } = claimed;

  let succeeded: string[];
  let failed: string[];
  try {
    const result = await submitScrobble({
      userId: callerId,
      artist,
      track,
      album,
      timestamp: Math.floor(Date.now() / 1000),
    });
    succeeded = result.succeeded;
    failed = result.failed;
  } catch (scrobbleError) {
    console.error(`scrobble-callback: submitScrobble threw for userId=${callerId} track="${track}"`, scrobbleError);
    await context.answerCallbackQuery({ text: t("common.service_error", lang, { service: "scrobbling" }) });
    return;
  }

  if (succeeded.length > 0) {
    await editCaptionAndDismiss(context, t("recommendation.scrobbled", lang));
    return;
  }

  const failedList = failed.join(", ");
  await editCaptionAndDismiss(context, t("scrobble.all_failed", lang, { failed: failedList }));
});

export default scrobbleCallback;
