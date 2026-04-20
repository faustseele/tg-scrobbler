import { createHash } from "node:crypto";

export interface LastfmConfig {
  apiKey: string;
  sharedSecret: string;
  apiUrl: string;
  authUrl: string;
}

/** shape of a successful auth.getToken response */
interface GetTokenResponse {
  token: string;
}

/** shape of a successful auth.getSession response */
interface GetSessionResponse {
  session: {
    name: string;
    key: string;
  };
}

/** shape returned when the Last.fm API reports an error */
interface LastfmErrorResponse {
  error: number;
  message: string;
}

/**
 * narrow an unknown API response to the error shape
 */
function isLastfmError(data: unknown): data is LastfmErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as LastfmErrorResponse).error === "number"
  );
}

/**
 * sort params alphabetically by key, concat as key1value1key2value2…,
 * append shared secret, return MD5 hex digest
 */
export function createApiSignature(
  params: Record<string, string>,
  sharedSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const concatenated = sortedKeys.reduce(
    (accumulator, key) => accumulator + key + params[key],
    ""
  );
  return createHash("md5")
    .update(concatenated + sharedSecret, "utf8")
    .digest("hex");
}

/**
 * call auth.getToken — returns a temporary token valid for 60 minutes
 */
export async function getToken(config: LastfmConfig): Promise<string> {
  const params: Record<string, string> = {
    api_key: config.apiKey,
    method: "auth.getToken",
  };
  const apiSig = createApiSignature(params, config.sharedSecret);

  const url = new URL(config.apiUrl);
  url.searchParams.set("method", "auth.getToken");
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("api_sig", apiSig);
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`auth.getToken failed — error ${data.error}: ${data.message}`);
    throw new Error(data.message);
  }

  return (data as GetTokenResponse).token;
}

/**
 * call auth.getSession — exchanges the approved token for a permanent session key
 */
export async function getSession(
  config: LastfmConfig,
  token: string
): Promise<{ name: string; key: string }> {
  const params: Record<string, string> = {
    api_key: config.apiKey,
    method: "auth.getSession",
    token,
  };
  const apiSig = createApiSignature(params, config.sharedSecret);

  const url = new URL(config.apiUrl);
  url.searchParams.set("method", "auth.getSession");
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("token", token);
  url.searchParams.set("api_sig", apiSig);
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`auth.getSession failed — error ${data.error}: ${data.message}`);
    throw new Error(data.message);
  }

  const { session } = data as GetSessionResponse;
  return { name: session.name, key: session.key };
}

/** shape of a successful track.scrobble response */
interface ScrobbleResponse {
  scrobbles: {
    "@attr": { accepted: number; ignored: number };
  };
}

/**
 * submit a single scrobble to the Last.fm (or Libre.fm) API
 * via track.scrobble — POST, form-encoded
 */
export async function scrobbleTrack(
  config: LastfmConfig,
  sessionKey: string,
  artist: string,
  track: string,
  timestamp: number,
  album?: string
): Promise<void> {
  const sigParams: Record<string, string> = {
    api_key: config.apiKey,
    artist,
    method: "track.scrobble",
    sk: sessionKey,
    timestamp: String(timestamp),
    track,
  };

  if (album !== undefined) {
    sigParams.album = album;
  }

  const apiSig = createApiSignature(sigParams, config.sharedSecret);

  const body = new URLSearchParams({ ...sigParams, api_sig: apiSig, format: "json" });

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`track.scrobble failed — error ${data.error}: ${data.message}`);
    throw new Error(data.message);
  }

  const scrobbleData = data as ScrobbleResponse;
  const ignored = scrobbleData.scrobbles["@attr"].ignored;
  if (ignored > 0) {
    console.warn(`track.scrobble — ${ignored} scrobble(s) ignored by Last.fm`);
  }
}

/**
 * construct the URL where the user authorises the app
 */
export function getAuthUrl(config: LastfmConfig, token: string): string {
  const url = new URL(config.authUrl);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("token", token);
  return url.toString();
}

/** normalised loved track data from user.getLovedTracks */
export interface LovedTrack {
  artist: string;
  track: string;
  trackUrl: string;
  /** human-readable date, null when the API omits it */
  lovedAt: string | null;
}

/** raw artist block inside a loved track entry — uses .name, not .#text */
interface LastfmLovedTrackArtist {
  name: string;
}

/** raw date block in a loved track entry */
interface LastfmLovedTrackDate {
  "#text": string;
}

/** raw entry from user.getLovedTracks */
interface LastfmLovedTrackEntry {
  name: string;
  url: string;
  artist: LastfmLovedTrackArtist;
  date?: LastfmLovedTrackDate;
}

/** shape of a successful user.getLovedTracks response */
interface LovedTracksResponse {
  lovedtracks: {
    track: LastfmLovedTrackEntry[];
  };
}

/** raw image entry from the Last.fm track payload */
interface LastfmImage {
  "#text": string;
  size: string;
}

/** period options accepted by the user.getTop* endpoints */
export type TopPeriod = "7day" | "1month" | "3month" | "12month" | "overall";

/** normalised entry returned by any of the top-list endpoints */
export interface TopItem {
  name: string;
  playCount: number;
  url: string;
  /** artist name — for albums/tracks. null for top artists */
  artist: string | null;
}

/** raw artist sub-object inside album/track entries */
interface LastfmEntryArtist {
  name: string;
}

/** raw album entry including image data — used when art URLs are needed */
interface LastfmTopAlbumEntryWithImage {
  name: string;
  playcount: string;
  url: string;
  artist: LastfmEntryArtist;
  image: LastfmImage[];
}

/** shape of a successful user.getTopAlbums response with image data */
interface TopAlbumsWithImagesResponse {
  topalbums: { album: LastfmTopAlbumEntryWithImage[] };
}

/** album entry including the extralarge art URL */
export interface AlbumWithArt {
  name: string;
  artist: string;
  playCount: number;
  /** extralarge album art URL, null when Last.fm has no art for this album */
  imageUrl: string | null;
}

/** raw track entry from user.getTopTracks */
interface LastfmTopTrackEntry {
  name: string;
  playcount: string;
  url: string;
  artist: LastfmEntryArtist;
}

/**
 * shared fetch + parse for all three user.getTop* methods —
 * each differs only in method name, response key, and entry shape
 */
async function fetchTopList<TEntry>(
  config: LastfmConfig,
  method: string,
  responseKey: string,
  listKey: string,
  username: string,
  period: TopPeriod,
  limit: number,
  toTopItem: (entry: TEntry) => TopItem
): Promise<TopItem[]> {
  const url = new URL(config.apiUrl);
  url.searchParams.set("method", method);
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("period", period);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`${method} failed — error ${data.error}: ${data.message}`);
    return [];
  }

  const wrapper = (data as Record<string, unknown>)[responseKey];
  if (typeof wrapper !== "object" || wrapper === null) {
    console.warn(`${method} — unexpected response shape`);
    return [];
  }

  const entries = (wrapper as Record<string, unknown>)[listKey];
  if (!Array.isArray(entries)) {
    return [];
  }

  return (entries as TEntry[]).map(toTopItem);
}

/**
 * fetch the user's top albums with album art URLs for a given period
 * via user.getTopAlbums — no signature required.
 * unlike getTopAlbums, this preserves the image array so callers can
 * retrieve the extralarge art URL for each album
 */
export async function getTopAlbumsWithArt(
  config: LastfmConfig,
  username: string,
  period: TopPeriod = "overall",
  limit: number = 10
): Promise<AlbumWithArt[]> {
  const url = new URL(config.apiUrl);
  url.searchParams.set("method", "user.gettopalbums");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("period", period);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`user.gettopalbums failed — error ${data.error}: ${data.message}`);
    return [];
  }

  const { topalbums } = data as TopAlbumsWithImagesResponse;
  const albums = topalbums.album;

  if (!Array.isArray(albums)) {
    return [];
  }

  return albums.map((entry) => {
    const extralargeImage = entry.image.find((image) => image.size === "extralarge");
    /** Last.fm returns an empty string when no art exists — treat that as null */
    const imageUrl = extralargeImage?.["#text"] || null;
    return {
      name: entry.name,
      artist: entry.artist.name,
      playCount: Number(entry.playcount),
      imageUrl,
    };
  });
}

/**
 * fetch the user's top tracks for a given period via user.getTopTracks —
 * no signature required
 */
export async function getTopTracks(
  config: LastfmConfig,
  username: string,
  period: TopPeriod = "overall",
  limit: number = 10
): Promise<TopItem[]> {
  return fetchTopList<LastfmTopTrackEntry>(
    config,
    "user.gettoptracks",
    "toptracks",
    "track",
    username,
    period,
    limit,
    (entry) => ({
      name: entry.name,
      playCount: Number(entry.playcount),
      url: entry.url,
      artist: entry.artist.name,
    })
  );
}

/** normalised similar track entry returned by track.getSimilar */
export interface SimilarTrack {
  artist: string;
  track: string;
  /** similarity score 0–1 */
  matchScore: number;
}

/** raw artist block inside a track.getSimilar entry — uses .name, not .#text */
interface LastfmSimilarTrackArtist {
  name: string;
}

/** raw entry from track.getSimilar */
interface LastfmSimilarTrackEntry {
  name: string;
  match: string;
  artist: LastfmSimilarTrackArtist;
}

/** shape of a successful track.getSimilar response */
interface SimilarTracksResponse {
  similartracks: {
    track: LastfmSimilarTrackEntry[];
  };
}

/**
 * fetch tracks similar to a given artist+track via track.getSimilar —
 * no signature required. returns empty array on any failure
 */
export async function getSimilarTracks(
  config: LastfmConfig,
  artist: string,
  track: string,
  limit: number = 10
): Promise<SimilarTrack[]> {
  const url = new URL(config.apiUrl);
  url.searchParams.set("method", "track.getSimilar");
  url.searchParams.set("artist", artist);
  url.searchParams.set("track", track);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());
  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`track.getSimilar failed — error ${data.error}: ${data.message}`);
    return [];
  }

  const { similartracks } = data as SimilarTracksResponse;
  const tracks = similartracks.track;

  if (!Array.isArray(tracks)) {
    console.warn(`track.getSimilar — unexpected response shape for "${artist} - ${track}"`);
    return [];
  }

  return tracks.map((entry) => ({
    artist: entry.artist.name,
    track: entry.name,
    matchScore: parseFloat(entry.match),
  }));
}

/**
 * fetch the most recently loved tracks for a user
 * via user.getLovedTracks — no signature required
 */
export async function getLovedTracks(
  config: LastfmConfig,
  username: string,
  limit: number = 5
): Promise<LovedTrack[]> {
  const url = new URL(config.apiUrl);
  url.searchParams.set("method", "user.getlovedtracks");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());
  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`user.getlovedtracks failed — error ${data.error}: ${data.message}`);
    return [];
  }

  const { lovedtracks } = data as LovedTracksResponse;
  const tracks = lovedtracks.track;

  if (!tracks.length) {
    return [];
  }

  return tracks.map((entry) => ({
    artist: entry.artist.name,
    track: entry.name,
    trackUrl: entry.url,
    lovedAt: entry.date?.["#text"] ?? null,
  }));
}
