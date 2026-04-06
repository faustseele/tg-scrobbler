import { Composer, Context } from "grammy";
import { librefmConfig } from "../config.js";
import { createScrobblerAuthComposer } from "./scrobbler-auth.js";

let composer: Composer<Context>;

if (!librefmConfig) {
  composer = new Composer<Context>();
  composer.command("login_librefm", async (context) => {
    await context.reply("Libre.fm is not configured.");
  });
} else {
  composer = createScrobblerAuthComposer({
    config: librefmConfig,
    serviceType: "librefm",
    serviceName: "Libre.fm",
    commandName: "login_librefm",
    callbackPrefix: "librefm_auth_done",
  });
}

export default composer;
