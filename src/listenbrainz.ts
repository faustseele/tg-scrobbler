const BASE_URL = "https://api.listenbrainz.org";

/**
 * convert a unix timestamp (seconds) to a localised human-readable string
 */
function formatListenTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

/** shape of the validate-token API response */
interface ValidateTokenResponse {
  code: number;
  message: string;
  valid: boolean;
  user_name?: string;
}

/**
 * narrow an unknown API response to the validate-token shape
 */
function isValidateTokenResponse(data: unknown): data is ValidateTokenResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    typeof (data as ValidateTokenResponse).code === "number" &&
    "valid" in data &&
    typeof (data as ValidateTokenResponse).valid === "boolean"
  );
}

/**
 * call /1/validate-token — checks whether a ListenBrainz user token is valid
 * and returns the associated username when it is
 */
export async function validateToken(
  token: string
): Promise<{ valid: boolean; userName: string | null }> {
  const url = new URL("/1/validate-token", BASE_URL);
  url.searchParams.set("token", token);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (networkError) {
    console.warn(`validateToken network error: ${String(networkError)}`);
    throw networkError;
  }

  const data: unknown = await response.json();

  if (!isValidateTokenResponse(data)) {
    console.warn(
      `validateToken — unexpected response shape from ListenBrainz: ${JSON.stringify(data)}`
    );
    throw new Error("Unexpected response from ListenBrainz validate-token endpoint");
  }

  if (!data.valid) {
    return { valid: false, userName: null };
  }

  const userName = data.user_name ?? null;
  if (userName === null) {
    console.warn("validateToken — token marked valid but user_name missing from response");
  }

  return { valid: true, userName };
}

/** normalised loved track data from the feedback endpoint */
export interface LovedTrack {
  artist: string;
  track: string;
  trackUrl: string;
  /** human-readable date derived from the unix timestamp */
  lovedAt: string | null;
}

/** shape of the track_metadata object sent to the submit-listens endpoint */
interface TrackMetadata {
  artist_name: string;
  track_name: string;
  release_name?: string;
}

/** shape of a single payload entry for the submit-listens endpoint */
interface ListenPayloadEntry {
  listened_at: number;
  track_metadata: TrackMetadata;
}

/** shape of the submit-listens request body */
interface SubmitListensBody {
  listen_type: "single";
  payload: [ListenPayloadEntry];
}

/**
 * POST a single listen to /1/submit-listens — records a scrobble for the
 * user identified by the given token
 */
export async function submitListen(
  token: string,
  artist: string,
  track: string,
  timestamp: number,
  album?: string
): Promise<void> {
  const url = new URL("/1/submit-listens", BASE_URL);

  const trackMetadata: TrackMetadata = {
    artist_name: artist,
    track_name: track,
  };
  if (album !== undefined) {
    trackMetadata.release_name = album;
  }

  const body: SubmitListensBody = {
    listen_type: "single",
    payload: [{ listened_at: timestamp, track_metadata: trackMetadata }],
  };

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    console.warn(`submitListen network error: ${String(networkError)}`);
    throw networkError;
  }

  if (!response.ok) {
    console.warn(
      `submitListen — ListenBrainz returned ${response.status} for artist="${artist}" track="${track}"`
    );
    throw new Error(`ListenBrainz submit-listens failed with status ${response.status}`);
  }
}

/** track_metadata block in a feedback entry — may be absent for some entries */
interface FeedbackTrackMetadata {
  artist_name: string;
  track_name: string;
}

/** shape of a single entry in the get-feedback response */
interface FeedbackEntry {
  track_metadata?: FeedbackTrackMetadata;
  /** unix timestamp (seconds) of when the track was loved */
  created: number;
}

/** shape of the get-feedback API response */
interface FeedbackResponse {
  feedback: FeedbackEntry[];
}

/**
 * narrow an unknown API response to the feedback shape
 */
function isFeedbackResponse(data: unknown): data is FeedbackResponse {
  if (typeof data !== "object" || data === null) return false;
  if (!("feedback" in data)) return false;
  return Array.isArray((data as FeedbackResponse).feedback);
}

/**
 * fetch a user's loved tracks from ListenBrainz feedback —
 * entries without track_metadata are skipped
 */
export async function getLovedTracks(
  userName: string,
  limit: number = 5
): Promise<LovedTrack[]> {
  const url = new URL(
    `/1/feedback/user/${userName}/get-feedback`,
    BASE_URL
  );
  url.searchParams.set("score", "1");
  url.searchParams.set("count", String(limit));

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (networkError) {
    console.warn(`getLovedTracks network error for user "${userName}": ${String(networkError)}`);
    return [];
  }

  if (!response.ok) {
    console.warn(
      `getLovedTracks — ListenBrainz returned ${response.status} for user "${userName}"`
    );
    return [];
  }

  const data: unknown = await response.json();

  if (!isFeedbackResponse(data)) {
    console.warn(
      `getLovedTracks — unexpected response shape for user "${userName}": ${JSON.stringify(data)}`
    );
    return [];
  }

  const result: LovedTrack[] = [];

  for (const entry of data.feedback) {
    if (!entry.track_metadata) {
      /** skip entries where Last.fm track_metadata is absent */
      continue;
    }
    result.push({
      artist: entry.track_metadata.artist_name,
      track: entry.track_metadata.track_name,
      trackUrl: "",
      lovedAt: formatListenTimestamp(entry.created),
    });
  }

  return result;
}
