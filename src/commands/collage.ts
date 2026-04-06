import { Composer, Context, InputFile } from "grammy";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { lastfmConfig } from "../config.js";
import { getTopAlbumsWithArt } from "../lastfm.js";
import { createCollageImage } from "../collage.js";

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

  const telegramId = BigInt(from.id);

  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  const user = userRow[0];
  if (!user) {
    await context.reply("Collage requires a Last.fm connection for now.");
    return;
  }

  const lastfmRow = await db
    .select({ serviceUsername: serviceConnections.serviceUsername })
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.userId, user.id),
        eq(serviceConnections.serviceType, "lastfm")
      )
    )
    .limit(1);

  const lastfmConnection = lastfmRow[0];
  if (!lastfmConnection) {
    await context.reply("Collage requires a Last.fm connection for now.");
    return;
  }

  const serviceUsername = lastfmConnection.serviceUsername;
  if (!serviceUsername) {
    console.warn(`/collage — Last.fm connection for userId=${user.id} has no serviceUsername`);
    await context.reply("Something went wrong with your Last.fm connection. Try reconnecting.");
    return;
  }

  const generatingMessage = await context.reply("Generating collage...");

  const albums = await getTopAlbumsWithArt(lastfmConfig, serviceUsername, "3month", 9);

  if (!albums.length) {
    await context.api.deleteMessage(generatingMessage.chat.id, generatingMessage.message_id);
    await context.reply("Not enough listening history for a collage.");
    return;
  }

  const imageUrls = albums.map((album) => album.imageUrl);
  const collageBuffer = await createCollageImage(imageUrls);

  await context.replyWithPhoto(new InputFile(collageBuffer, "collage.png"), {
    caption: `${serviceUsername}'s 3 months album collage`,
  });

  await context.api.deleteMessage(generatingMessage.chat.id, generatingMessage.message_id);
});

export default composer;
