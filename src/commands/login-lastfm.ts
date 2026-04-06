import { lastfmConfig } from "../config.js";
import { createScrobblerAuthComposer } from "./scrobbler-auth.js";

const composer = createScrobblerAuthComposer({
  config: lastfmConfig,
  serviceType: "lastfm",
  serviceName: "Last.fm",
  commandName: "login_lastfm",
  callbackPrefix: "lastfm_auth_done",
});

export default composer;
