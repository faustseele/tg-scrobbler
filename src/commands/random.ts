import { Composer, Context } from "grammy";
import { lastfmConfig } from "../config.js";
import { getTopArtists, getTopAlbums, getTopTracks } from "../lastfm.js";
import type { TopItem } from "../lastfm.js";
import { resolveLastfmConnection } from "../user-lookup.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";

const composer = new Composer<Context>();

/** entity types the random picker can select from */
type EntityType = "artists" | "albums" | "tracks";

const entityTypes: EntityType[] = ["artists", "albums", "tracks"];

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

  const lang = from.language_code ?? "en";
  const connection = await resolveLastfmConnection(BigInt(from.id));
  if (!connection) {
    await context.reply(t("common.no_lastfm", lang));
    return;
  }

  const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];

  const items = await fetchItems(entityType, connection.serviceUsername);

  if (!items.length) {
    await context.reply(t("random.no_history", lang));
    return;
  }

  const item = items[Math.floor(Math.random() * items.length)];

  await context.reply(formatRandomReply(item, entityType), { parse_mode: "HTML" });
});

export default composer;
