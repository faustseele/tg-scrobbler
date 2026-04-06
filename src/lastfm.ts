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
