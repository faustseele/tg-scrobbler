import { Composer, Context, InputFile } from "grammy";
import { lastfmConfig } from "../config.js";
import { getTopAlbumsWithArt } from "../lastfm.js";
import { createCollageImage } from "../collage.js";
import { resolveLastfmConnection } from "../user-lookup.js";
import { t } from "../i18n/index.js";

const composer = new Composer<Context>();

/**
 * /collage — generate a 3×3 top-album-art grid for the user's
 * Last.fm listening history over the past 3 months
 */
composer.command("collage", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("/collage received with no from field");
    return;
  }

  const lang = from.language_code ?? "en";
  const connection = await resolveLastfmConnection(BigInt(from.id));
  if (!connection) {
    await context.reply(t("common.no_lastfm", lang));
    return;
  }

  const generatingMessage = await context.reply(t("collage.generating", lang));

  const albums = await getTopAlbumsWithArt(lastfmConfig, connection.serviceUsername, "3month", 9);

  if (!albums.length) {
    await context.api.deleteMessage(generatingMessage.chat.id, generatingMessage.message_id);
    await context.reply(t("collage.no_history", lang));
    return;
  }

  const imageUrls = albums.map((album) => album.imageUrl);
  const collageBuffer = await createCollageImage(imageUrls);

  await context.replyWithPhoto(new InputFile(collageBuffer, "collage.png"), {
    caption: t("collage.caption", lang, { username: connection.serviceUsername, period: "3 months" }),
  });

  await context.api.deleteMessage(generatingMessage.chat.id, generatingMessage.message_id);
});

export default composer;
