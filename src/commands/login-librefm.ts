import { Composer, Context } from "grammy";
import { t } from "../i18n/index.js";
import { librefmConfig } from "../config.js";
import { createScrobblerAuthComposer } from "./scrobbler-auth.js";

let composer: Composer<Context>;

if (!librefmConfig) {
  composer = new Composer<Context>();
  composer.command("login_librefm", async (context) => {
    const lang = context.from?.language_code ?? "en";
    await context.reply(t("auth.librefm_unconfigured", lang));
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
