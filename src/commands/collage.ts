import { Composer, Context, InputFile, InlineKeyboard } from "grammy";
import { lastfmConfig } from "../config.js";
import { getTopAlbumsWithArt, TopPeriod } from "../lastfm.js";
import { createCollageImage } from "../collage.js";
import { resolveLastfmConnection } from "../user-lookup.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";

const composer = new Composer<Context>();

/** maps a collage callback period token to the LastFm TopPeriod value */
type CollagePeriodToken = "1month" | "3month" | "12month";

/** maps a CollagePeriodToken to its i18n key for the human-readable caption period */
const periodCaptionKey: Record<CollagePeriodToken, string> = {
  "1month": "collage.period_month",
  "3month": "collage.period_3month",
  "12month": "collage.period_year",
};

/**
 * /collage — present the user with an inline keyboard to pick a time-frame
 * for a 3×3 top-album-art grid
 */
composer.command("collage", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("/collage received with no from field");
    return;
  }

  const lang = from.language_code ?? "en";

  const keyboard = new InlineKeyboard()
    .text(t("collage.period_month_button", lang), "collage:1month")
    .text(t("collage.period_3month_button", lang), "collage:3month")
    .text(t("collage.period_year_button", lang), "collage:12month");

  await context.reply(t("collage.choose_period", lang), {
    reply_markup: keyboard,
  });
});

/**
 * callback handler for collage period selection — fetches top albums,
 * generates the 3×3 grid image, and sends it as a photo
 */
composer.callbackQuery(/^collage:(1month|3month|12month)$/, async (context) => {
  const from = context.from;
  const lang = from.language_code ?? "en";

  await context.answerCallbackQuery();

  let connection: { userId: number; serviceUsername: string } | null;
  try {
    connection = await resolveLastfmConnection(BigInt(from.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`collage callback: resolveLastfmConnection failed for telegramId=${from.id}: ${message}`);
    await context.editMessageText(t("common.no_lastfm", lang));
    return;
  }

  if (!connection) {
    await context.editMessageText(t("common.no_lastfm", lang));
    return;
  }

  const { serviceUsername } = connection;

  /** context.match[1] is guaranteed by the regex — cast is safe here */
  const periodToken = context.match[1] as CollagePeriodToken;
  /** 12month maps to "12month" which is a valid TopPeriod */
  const topPeriod: TopPeriod = periodToken;

  await context.editMessageText(t("collage.generating", lang), {
    reply_markup: undefined,
  });

  let albums: Awaited<ReturnType<typeof getTopAlbumsWithArt>>;
  try {
    albums = await getTopAlbumsWithArt(lastfmConfig, serviceUsername, topPeriod, 9);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`collage callback: getTopAlbumsWithArt failed for username=${serviceUsername}: ${message}`);
    await context.editMessageText(t("collage.no_history", lang));
    return;
  }

  if (!albums.length) {
    await context.editMessageText(t("collage.no_history", lang));
    return;
  }

  const imageUrls = albums.map((album) => album.imageUrl);
  const collageBuffer = await createCollageImage(imageUrls);

  const humanPeriod = t(periodCaptionKey[periodToken], lang);
  const caption = t("collage.caption", lang, {
    username: escapeHtml(serviceUsername),
    period: humanPeriod,
  });

  try {
    await context.deleteMessage();
  } catch (deleteError) {
    /** non-fatal — the status message may already be gone */
    console.warn(`collage callback: failed to delete status message for telegramId=${from.id}`, deleteError);
  }

  await context.replyWithPhoto(new InputFile(collageBuffer, "collage.png"), {
    caption,
    parse_mode: "HTML",
  });
});

export default composer;
