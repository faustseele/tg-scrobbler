import { Composer, Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { lastfmConfig } from "../config.js";
import { getTopArtists, getTopAlbums, getTopTracks } from "../lastfm.js";
import type { TopItem } from "../lastfm.js";

const composer = new Composer<Context>();

/** entity types the random picker can select from */
type EntityType = "artists" | "albums" | "tracks";

const entityTypes: EntityType[] = ["artists", "albums", "tracks"];

/**
 * escape characters that have special meaning in Telegram HTML parse mode
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * format a random TopItem pick into the HTML reply string
 */
function formatRandomReply(item: TopItem, entityType: EntityType): string {
  const name = escapeHtml(item.name);
  const artist = item.artist !== null ? escapeHtml(item.artist) : null;

  if (entityType === "artists") {
    return `🎲 <b>${name}</b> — ${item.playCount} plays\n${item.url}`;
  }

  return `🎲 <b>${artist} — ${name}</b> — ${item.playCount} plays\n${item.url}`;
}

/**
 * fetch the top list for the given entity type — overall period, limit 50
 */
async function fetchItems(
  entityType: EntityType,
  username: string
): Promise<TopItem[]> {
  if (entityType === "artists") {
    return getTopArtists(lastfmConfig, username, "overall", 50);
  }
  if (entityType === "albums") {
    return getTopAlbums(lastfmConfig, username, "overall", 50);
  }
  return getTopTracks(lastfmConfig, username, "overall", 50);
}

/**
 * /random — pick a random artist, album, or track from the user's top history
 */
composer.command("random", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("/random received with no from field");
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
    await context.reply("Random picks require a Last.fm connection for now.");
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
    await context.reply("Random picks require a Last.fm connection for now.");
    return;
  }

  const serviceUsername = lastfmConnection.serviceUsername;
  if (!serviceUsername) {
    console.warn(`/random — Last.fm connection for userId=${user.id} has no serviceUsername`);
    await context.reply("Something went wrong with your Last.fm connection. Try reconnecting.");
    return;
  }

  const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];

  const items = await fetchItems(entityType, serviceUsername);

  if (!items.length) {
    await context.reply("Not enough history yet. Scrobble more!");
    return;
  }

  const item = items[Math.floor(Math.random() * items.length)];

  await context.reply(formatRandomReply(item, entityType), { parse_mode: "HTML" });
});

export default composer;
