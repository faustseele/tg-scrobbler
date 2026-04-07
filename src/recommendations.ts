import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { scrobbleCache, sentDiscoveries } from "./schema.js";
import { getTopTracks, getSimilarTracks, SimilarTrack } from "./lastfm.js";
import { lastfmConfig } from "./config.js";

/**
 * build the exclusion set for a user — combines tracks already scrobbled
 * (from scrobble_cache) with tracks already recommended (from sent_discoveries).
 * keys are lowercase "artist - track" strings
 */
async function buildExclusionSet(userId: number): Promise<Set<string>> {
  const [scrobbledRows, discoveryRows] = await Promise.all([
    db
      .selectDistinct({ artist: scrobbleCache.artist, track: scrobbleCache.track })
      .from(scrobbleCache)
      .where(eq(scrobbleCache.userId, userId)),
    db
      .select({ trackKey: sentDiscoveries.trackKey })
      .from(sentDiscoveries)
      .where(eq(sentDiscoveries.userId, userId)),
  ]);

  const exclusions = new Set<string>();

  for (const row of scrobbledRows) {
    exclusions.add(`${row.artist.toLowerCase()} - ${row.track.toLowerCase()}`);
  }

  for (const row of discoveryRows) {
    exclusions.add(row.trackKey.toLowerCase());
  }

  return exclusions;
}

/**
 * fetch personalised track recommendations for a user.
 * seeds from the user's top 20 all-time tracks, fans out via track.getSimilar,
 * then filters out anything already scrobbled or previously recommended.
 * returns results sorted by similarity score descending
 */
export async function getRecommendations(
  userId: number,
  username: string,
  limit: number = 10
): Promise<SimilarTrack[]> {
  const topTracks = await getTopTracks(lastfmConfig, username, "overall", 20);

  if (!topTracks.length) {
    console.warn(`getRecommendations — no top tracks found for user ${userId} (${username})`);
    return [];
  }

  const similarResults = await Promise.allSettled(
    topTracks.map((item) => {
      const artist = item.artist;
      if (!artist) return Promise.resolve([] as SimilarTrack[]);
      return getSimilarTracks(lastfmConfig, artist, item.name, 5);
    })
  );

  const pool: SimilarTrack[] = [];
  for (const result of similarResults) {
    if (result.status === "fulfilled") {
      pool.push(...result.value);
    }
  }

  /** deduplicate by lowercase "artist - track" key — keep first occurrence (highest seed rank) */
  const seen = new Set<string>();
  const deduplicated: SimilarTrack[] = [];
  for (const candidate of pool) {
    const key = `${candidate.artist.toLowerCase()} - ${candidate.track.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(candidate);
    }
  }

  const exclusions = await buildExclusionSet(userId);

  const filtered = deduplicated.filter((candidate) => {
    const key = `${candidate.artist.toLowerCase()} - ${candidate.track.toLowerCase()}`;
    return !exclusions.has(key);
  });

  console.info(
    `getRecommendations — userId=${userId}: pool=${pool.length} deduped=${deduplicated.length} after_filter=${filtered.length}`
  );

  filtered.sort((a, b) => b.matchScore - a.matchScore);

  return filtered.slice(0, limit);
}
