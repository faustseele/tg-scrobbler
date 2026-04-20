import { Composer, Context } from "grammy";
import { eq } from "drizzle-orm";
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

scrobbleCallback.callbackQuery(REC_CALLBACK_PATTERN, async (context) => {
  const lang = context.from?.language_code ?? "en";
  const rawId = context.match[1];
  const pendingId = parseInt(rawId, 10);

  /** look up the caller's internal user id first — needed for ownership check */
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
    /** user hit a button before they've ever interacted with the bot */
    await context.answerCallbackQuery({ text: t("recommendation.not_yours", lang) });
    return;
  }

  /** fetch the pending row */
  let pendingRow: { id: number; userId: number; artist: string; track: string; album: string | null } | undefined;
  try {
    const pendingRows = await db
      .select({
        id: pendingScrobbles.id,
        userId: pendingScrobbles.userId,
        artist: pendingScrobbles.artist,
        track: pendingScrobbles.track,
        album: pendingScrobbles.album,
      })
      .from(pendingScrobbles)
      .where(eq(pendingScrobbles.id, pendingId))
      .limit(1);

    pendingRow = pendingRows[0];
  } catch (fetchError) {
    console.error(`scrobble-callback: failed to fetch pendingScrobbles id=${pendingId}`, fetchError);
    await context.answerCallbackQuery({ text: t("common.service_error", lang, { service: "the bot" }) });
    return;
  }

  if (!pendingRow) {
    /** row was already consumed — button is stale */
    try {
      await context.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    } catch {
      /** message may be too old to edit — not critical */
    }
    await context.answerCallbackQuery({ text: t("recommendation.already_scrobbled", lang) });
    return;
  }

  if (pendingRow.userId !== callerId) {
    await context.answerCallbackQuery({ text: t("recommendation.not_yours", lang) });
    return;
  }

  const { userId, artist, track, album } = pendingRow;

  /** delete the pending row before submitting — prevents double-scrobble on retaps */
  try {
    await db.delete(pendingScrobbles).where(eq(pendingScrobbles.id, pendingId));
  } catch (deleteError) {
    console.error(`scrobble-callback: failed to delete pendingScrobbles id=${pendingId}`, deleteError);
    await context.answerCallbackQuery({ text: t("common.service_error", lang, { service: "the bot" }) });
    return;
  }

  let succeeded: string[];
  let failed: string[];

  try {
    const result = await submitScrobble({
      userId,
      artist,
      track,
      album,
      timestamp: Math.floor(Date.now() / 1000),
    });
    succeeded = result.succeeded;
    failed = result.failed;
  } catch (scrobbleError) {
    console.error(`scrobble-callback: submitScrobble threw for userId=${userId} track="${track}"`, scrobbleError);
    await context.answerCallbackQuery({ text: t("common.service_error", lang, { service: "scrobbling" }) });
    return;
  }

  const message = context.callbackQuery.message;
  const chatId = message?.chat.id;
  const messageId = message?.message_id;

  if (succeeded.length > 0) {
    const baseCaption = message && "caption" in message ? (message.caption ?? "") : "";
    const scrobbledLine = t("recommendation.scrobbled", lang);
    const updatedCaption = `${baseCaption}\n\n${scrobbledLine}`;

    if (chatId && messageId) {
      try {
        await context.api.editMessageCaption(chatId, messageId, {
          caption: updatedCaption,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] },
        });
      } catch (editError) {
        /** non-fatal — message may be too old to edit */
        console.warn(`scrobble-callback: could not edit caption for messageId=${messageId}`, editError);
      }
    }

    await context.answerCallbackQuery();
  } else {
    /** all services rejected — row is already gone so button won't work on retry anyway */
    const failedList = failed.join(", ");
    const failCaption = message && "caption" in message ? (message.caption ?? "") : "";
    const updatedCaption = `${failCaption}\n\n${t("scrobble.all_failed", lang, { failed: failedList })}`;

    if (chatId && messageId) {
      try {
        await context.api.editMessageCaption(chatId, messageId, {
          caption: updatedCaption,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] },
        });
      } catch (editError) {
        console.warn(`scrobble-callback: could not edit caption on failure for messageId=${messageId}`, editError);
      }
    }

    await context.answerCallbackQuery();
  }
});

export default scrobbleCallback;
