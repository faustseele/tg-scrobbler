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
function formatRandomReply(item: TopItem, entityType: EntityType, lang: string): string {
  const name = escapeHtml(item.name);
  const escapedUrl = escapeHtml(item.url);
  const plays = item.playCount === 1 ? "1 play" : `${item.playCount} plays`;
  const prefix = t("random.prefix", lang);
  const link = `<a href="${escapedUrl}">${escapedUrl}</a>`;

  if (entityType === "artists") {
    return `${prefix} <b>${name}</b> \u2014 ${plays}\n${link}`;
  }

  const artist = item.artist !== null ? escapeHtml(item.artist) : null;
  return `${prefix} <b>${artist}</b> \u2014 ${name} \u2014 ${plays}\n${link}`;
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

  await context.reply(formatRandomReply(item, entityType, lang), { parse_mode: "HTML" });
});

export default composer;
