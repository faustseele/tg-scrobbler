const BASE_URL = "https://api.listenbrainz.org";

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
