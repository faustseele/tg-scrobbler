import { Composer, Context, InlineKeyboard } from "grammy";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { lastfmConfig } from "../config.js";
import {
  getTopArtists,
  getTopAlbums,
  getTopTracks,
  TopItem,
  TopPeriod,
} from "../lastfm.js";

const composer = new Composer<Context>();

/** entity types supported by the top lists flow */
type EntityType = "artists" | "albums" | "tracks";

/** human-readable period labels */
const PERIOD_LABELS: Record<TopPeriod, string> = {
  "7day": "this week",
  "1month": "this month",
  "3month": "3 months",
  "12month": "this year",
  "overall": "all time",
};

/** human-readable entity type labels */
const ENTITY_LABELS: Record<EntityType, string> = {
  artists: "artists",
  albums: "albums",
  tracks: "tracks",
};

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
 * build the entity type selection keyboard shown on /toplists
 */
function buildEntityKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Artists", "toplists:artists")
    .text("Albums", "toplists:albums")
    .text("Tracks", "toplists:tracks");
}

/**
 * build the period selection keyboard shown after entity type is chosen
 */
function buildPeriodKeyboard(entityType: EntityType): InlineKeyboard {
  return new InlineKeyboard()
    .text("Week", `toplists:${entityType}:7day`)
    .text("Month", `toplists:${entityType}:1month`)
    .text("3 Months", `toplists:${entityType}:3month`)
    .text("Year", `toplists:${entityType}:12month`)
    .text("All Time", `toplists:${entityType}:overall`);
}

/**
 * format a single TopItem as an HTML list entry —
 * artists show name only; albums & tracks include the artist
 */
function formatTopItem(item: TopItem, index: number, entityType: EntityType): string {
  const escapedName = escapeHtml(item.name);
  const escapedUrl = escapeHtml(item.url);
  const plays = item.playCount === 1 ? "1 play" : `${item.playCount} plays`;

  if (entityType === "artists" || item.artist === null) {
    return `${index + 1}. <a href="${escapedUrl}">${escapedName}</a> — ${plays}`;
  }

  const escapedArtist = escapeHtml(item.artist);
  return `${index + 1}. <a href="${escapedUrl}">${escapedArtist} — ${escapedName}</a> — ${plays}`;
}

/**
 * compose the full top list message from fetched items
 */
function formatTopList(
  items: TopItem[],
  entityType: EntityType,
  period: TopPeriod
): string {
  const entityLabel = ENTITY_LABELS[entityType];
  const periodLabel = PERIOD_LABELS[period];

  if (!items.length) {
    return `No data for this period.`;
  }

  const header = `\u{1F3C6} Top ${entityLabel} (${periodLabel}):`;
  const lines = items.map((item, index) => formatTopItem(item, index, entityType));
  return [header, ...lines].join("\n");
}

/**
 * look up the Last.fm username for a given Telegram user id —
 * returns null if no Last.fm connection exists
 */
async function getLastfmUsername(telegramId: bigint): Promise<string | null> {
  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  const user = userRow[0];
  if (!user) return null;

  const connectionRow = await db
    .select({ serviceUsername: serviceConnections.serviceUsername })
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.userId, user.id),
        eq(serviceConnections.serviceType, "lastfm")
      )
    )
    .limit(1);

  const connection = connectionRow[0];
  if (!connection) return null;

  return connection.serviceUsername;
}

/**
 * fetch the top list for the given entity type + period combo
 */
async function fetchTopList(
  username: string,
  entityType: EntityType,
  period: TopPeriod
): Promise<TopItem[]> {
  if (entityType === "artists") {
    return getTopArtists(lastfmConfig, username, period);
  }
  if (entityType === "albums") {
    return getTopAlbums(lastfmConfig, username, period);
  }
  return getTopTracks(lastfmConfig, username, period);
}

/**
 * /toplists — opens the entity type selection keyboard
 */
composer.command("toplists", async (context) => {
  await context.reply("What do you want to see?", {
    reply_markup: buildEntityKeyboard(),
  });
});

/**
 * callback: toplists:{entityType} — replace keyboard with period picker
 */
composer.callbackQuery(/^toplists:(artists|albums|tracks)$/, async (context) => {
  const match = context.match;
  const entityType = match[1] as EntityType;

  await context.editMessageText("Pick a period:", {
    reply_markup: buildPeriodKeyboard(entityType),
  });

  await context.answerCallbackQuery();
});

/**
 * callback: toplists:{entityType}:{period} — fetch & display the top list
 */
composer.callbackQuery(
  /^toplists:(artists|albums|tracks):(7day|1month|3month|12month|overall)$/,
  async (context) => {
    const match = context.match;
    const entityType = match[1] as EntityType;
    const period = match[2] as TopPeriod;

    const from = context.from;
    if (!from) {
      console.warn("/toplists callback received with no from field");
      await context.answerCallbackQuery();
      return;
    }

    const telegramId = BigInt(from.id);
    const username = await getLastfmUsername(telegramId);

    if (!username) {
      await context.editMessageText(
        "Top lists require a Last.fm connection for now."
      );
      await context.answerCallbackQuery();
      return;
    }

    const items = await fetchTopList(username, entityType, period);
    const message = formatTopList(items, entityType, period);

    await context.editMessageText(message, { parse_mode: "HTML" });
    await context.answerCallbackQuery();
  }
);

export default composer;
