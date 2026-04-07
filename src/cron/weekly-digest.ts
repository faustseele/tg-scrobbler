import cron from "node-cron";
import { Bot } from "grammy";
import { sql, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections, scrobbleCache } from "../schema.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";

/** top artist entry aggregated from scrobble_cache */
interface TopArtist {
  artist: string;
  playCount: number;
}

/** top track entry aggregated from scrobble_cache */
interface TopTrack {
  artist: string;
  track: string;
  playCount: number;
}

/** user row returned by the connected-users query */
interface ConnectedUser {
  telegramId: bigint;
  userId: number;
  language: string | null;
}

/**
 * fetch all users who have at least one service connection
 */
async function fetchConnectedUsers(): Promise<ConnectedUser[]> {
  const rows = await db
    .selectDistinct({
      telegramId: users.telegramId,
      userId: users.id,
      language: users.language,
    })
    .from(users)
    .innerJoin(serviceConnections, eq(serviceConnections.userId, users.id));

  return rows.map((row) => ({
    telegramId: row.telegramId,
    userId: row.userId,
    language: row.language,
  }));
}

/**
 * aggregate scrobble_cache for a single user over the past 7 days.
 * returns total count, top 5 artists, and top 5 tracks.
 */
async function fetchUserDigestData(
  userId: number,
  since: Date
): Promise<{ totalCount: number; topArtists: TopArtist[]; topTracks: TopTrack[] } | null> {
  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(scrobbleCache)
    .where(
      sql`${scrobbleCache.userId} = ${userId} and ${scrobbleCache.scrobbledAt} >= ${since}`
    );

  const totalCount = Number(totalRows[0]?.count ?? 0);
  if (totalCount === 0) return null;

  const artistRows = await db
    .select({
      artist: scrobbleCache.artist,
      playCount: sql<number>`count(*)`,
    })
    .from(scrobbleCache)
    .where(
      sql`${scrobbleCache.userId} = ${userId} and ${scrobbleCache.scrobbledAt} >= ${since}`
    )
    .groupBy(scrobbleCache.artist)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const trackRows = await db
    .select({
      artist: scrobbleCache.artist,
      track: scrobbleCache.track,
      playCount: sql<number>`count(*)`,
    })
    .from(scrobbleCache)
    .where(
      sql`${scrobbleCache.userId} = ${userId} and ${scrobbleCache.scrobbledAt} >= ${since}`
    )
    .groupBy(scrobbleCache.artist, scrobbleCache.track)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const topArtists: TopArtist[] = artistRows.map((row) => ({
    artist: row.artist,
    playCount: Number(row.playCount),
  }));

  const topTracks: TopTrack[] = trackRows.map((row) => ({
    artist: row.artist,
    track: row.track,
    playCount: Number(row.playCount),
  }));

  return { totalCount, topArtists, topTracks };
}

/**
 * format the weekly digest as an HTML message ready for Telegram
 */
function formatDigestMessage(
  totalCount: number,
  topArtists: TopArtist[],
  topTracks: TopTrack[],
  lang: string
): string {
  const artistLines = topArtists
    .map((entry, index) => {
      const playsLabel = entry.playCount === 1 ? "1 play" : `${entry.playCount} plays`;
      return `${index + 1}. <b>${escapeHtml(entry.artist)}</b> \u2014 ${playsLabel}`;
    })
    .join("\n");

  const trackLines = topTracks
    .map((entry, index) => {
      const playsLabel = entry.playCount === 1 ? "1 play" : `${entry.playCount} plays`;
      return `${index + 1}. <b>${escapeHtml(entry.artist)}</b> \u2014 ${escapeHtml(entry.track)} \u2014 ${playsLabel}`;
    })
    .join("\n");

  return [
    t("digest.header", lang),
    "",
    t("digest.scrobble_count", lang, { count: String(totalCount) }),
    "",
    t("digest.top_artists", lang),
    artistLines,
    "",
    t("digest.top_tracks", lang),
    trackLines,
  ].join("\n");
}

/**
 * register the weekly digest cron job. fires every Monday at 09:00 UTC.
 * queries all connected users, aggregates last-7-day scrobbles, and
 * sends each user their personal digest. failures per user are caught
 * individually so one bad send doesn't abort the rest.
 */
export function startWeeklyDigestCron(bot: Bot): void {
  cron.schedule(
    "0 9 * * 1",
    async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      let connectedUsers: ConnectedUser[];
      try {
        connectedUsers = await fetchConnectedUsers();
      } catch (error) {
        console.error("weekly digest: failed to fetch connected users", error);
        return;
      }

      for (const user of connectedUsers) {
        try {
          const data = await fetchUserDigestData(user.userId, since);
          if (!data) continue;

          const message = formatDigestMessage(
            data.totalCount,
            data.topArtists,
            data.topTracks,
            user.language ?? "en"
          );

          await bot.api.sendMessage(String(user.telegramId), message, {
            parse_mode: "HTML",
          });
        } catch (error) {
          console.error(
            `weekly digest: failed to send digest for user ${user.telegramId}`,
            error
          );
        }
      }
    },
    { timezone: "UTC" }
  );
}
