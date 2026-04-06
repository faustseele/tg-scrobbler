import { Composer, Context } from "grammy";
import { LastfmConfig } from "../lastfm.js";
import { createScrobblerAuthComposer } from "./scrobbler-auth.js";

const librefmApiKey = process.env.LIBREFM_API_KEY;
const librefmSharedSecret = process.env.LIBREFM_SHARED_SECRET;

/** no-op composer returned when Libre.fm credentials are absent */
function createUnconfiguredComposer(): Composer<Context> {
  const composer = new Composer<Context>();

  composer.command("login_librefm", async (context) => {
    await context.reply("Libre.fm is not configured.");
  });

  return composer;
}

let composer: Composer<Context>;

if (!librefmApiKey || !librefmSharedSecret) {
  console.warn("LIBREFM_API_KEY or LIBREFM_SHARED_SECRET not set — /login_librefm will be unavailable");
  composer = createUnconfiguredComposer();
} else {
  const librefmConfig: LastfmConfig = {
    apiKey: librefmApiKey,
    sharedSecret: librefmSharedSecret,
    apiUrl: "https://libre.fm/2.0/",
    authUrl: "https://libre.fm/api/auth/",
  };

  composer = createScrobblerAuthComposer({
    config: librefmConfig,
    serviceType: "librefm",
    serviceName: "Libre.fm",
    commandName: "login_librefm",
    callbackPrefix: "librefm_auth_done",
  });
}

export default composer;
