import { LastfmConfig } from "../lastfm.js";
import { createScrobblerAuthComposer } from "./scrobbler-auth.js";

const lastfmApiKey = process.env.LASTFM_API_KEY;
const lastfmSharedSecret = process.env.LASTFM_SHARED_SECRET;

if (!lastfmApiKey) {
  throw new Error("LASTFM_API_KEY is not set");
}

if (!lastfmSharedSecret) {
  throw new Error("LASTFM_SHARED_SECRET is not set");
}

const lastfmConfig: LastfmConfig = {
  apiKey: lastfmApiKey,
  sharedSecret: lastfmSharedSecret,
  apiUrl: "https://ws.audioscrobbler.com/2.0/",
  authUrl: "https://www.last.fm/api/auth/",
};

const composer = createScrobblerAuthComposer({
  config: lastfmConfig,
  serviceType: "lastfm",
  serviceName: "Last.fm",
  commandName: "login_lastfm",
  callbackPrefix: "lastfm_auth_done",
});

export default composer;
