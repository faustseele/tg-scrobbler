import { LastfmConfig } from "./lastfm.js";

const lastfmApiKey = process.env.LASTFM_API_KEY;
const lastfmSharedSecret = process.env.LASTFM_SHARED_SECRET;

if (!lastfmApiKey) {
  throw new Error("LASTFM_API_KEY is not set");
}

if (!lastfmSharedSecret) {
  throw new Error("LASTFM_SHARED_SECRET is not set");
}

export const lastfmConfig: LastfmConfig = {
  apiKey: lastfmApiKey,
  sharedSecret: lastfmSharedSecret,
  apiUrl: "https://ws.audioscrobbler.com/2.0/",
  authUrl: "https://www.last.fm/api/auth/",
};

const librefmApiKey = process.env.LIBREFM_API_KEY;
const librefmSharedSecret = process.env.LIBREFM_SHARED_SECRET;

if (!librefmApiKey || !librefmSharedSecret) {
  console.info("LIBREFM_API_KEY or LIBREFM_SHARED_SECRET not set — Libre.fm will be unavailable");
}

/** null when env vars are absent — Libre.fm is optional */
export const librefmConfig: LastfmConfig | null =
  librefmApiKey && librefmSharedSecret
    ? {
        apiKey: librefmApiKey,
        sharedSecret: librefmSharedSecret,
        apiUrl: "https://libre.fm/2.0/",
        authUrl: "https://libre.fm/api/auth/",
      }
    : null;
