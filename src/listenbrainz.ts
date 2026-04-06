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
