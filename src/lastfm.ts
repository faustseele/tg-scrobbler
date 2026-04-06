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

/** normalised track data from user.getRecentTracks */
export interface RecentTrack {
  artist: string;
  track: string;
  album: string;
  albumArtUrl: string | null;
  trackUrl: string;
  isNowPlaying: boolean;
  /** human-readable timestamp, null when the track is currently playing */
  timestamp: string | null;
}

/** raw image entry from the Last.fm track payload */
interface LastfmImage {
  "#text": string;
  size: string;
}

/** raw track entry from user.getRecentTracks */
interface LastfmTrackEntry {
  name: string;
  url: string;
  artist: { "#text": string };
  album: { "#text": string };
  image: LastfmImage[];
  date?: { uts: string; "#text": string };
  "@attr"?: { nowplaying: "true" };
}

/** shape of a successful user.getRecentTracks response */
interface RecentTracksResponse {
  recenttracks: {
    track: LastfmTrackEntry[];
  };
}

/**
 * fetch the most recent (or currently playing) track for a user
 * via user.getRecentTracks with limit=1 — no signature required
 */
export async function getRecentTrack(
  config: LastfmConfig,
  username: string
): Promise<RecentTrack | null> {
  const url = new URL(config.apiUrl);
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString());
  const data: unknown = await response.json();

  if (isLastfmError(data)) {
    console.warn(`user.getrecenttracks failed — error ${data.error}: ${data.message}`);
    return null;
  }

  const { recenttracks } = data as RecentTracksResponse;
  const tracks = recenttracks.track;

  if (!tracks.length) {
    return null;
  }

  const entry = tracks[0];
  const isNowPlaying = entry["@attr"]?.nowplaying === "true";

  const extralargeImage = entry.image.find((image) => image.size === "extralarge");
  /** Last.fm returns an empty string when no art exists — treat that as null */
  const albumArtUrl = extralargeImage?.["#text"] || null;

  return {
    artist: entry.artist["#text"],
    track: entry.name,
    album: entry.album["#text"],
    albumArtUrl,
    trackUrl: entry.url,
    isNowPlaying,
    timestamp: isNowPlaying ? null : (entry.date?.["#text"] ?? null),
  };
}
