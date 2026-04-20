import { Bot } from "grammy";
import { t } from "./i18n/index.js";
import loginLastfm from "./commands/login-lastfm.js";
import loginLibrefm from "./commands/login-librefm.js";
import loginListenbrainz from "./commands/login-listenbrainz.js";
import scrobble from "./commands/scrobble.js";
import collage from "./commands/collage.js";
import scrobbleCallback from "./commands/scrobble-callback.js";
import { startDiscoveryDispatchCron } from "./cron/discovery-dispatch.js";

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error("BOT_TOKEN is not set");
}

const bot = new Bot(botToken);

bot.command("start", (context) => {
  const lang = context.from?.language_code ?? "en";
  return context.reply(t("start.welcome", lang));
});

bot.use(loginLastfm);
bot.use(loginLibrefm);
bot.use(loginListenbrainz);
bot.use(scrobble);
bot.use(collage);
bot.use(scrobbleCallback);

const shutdown = () => {
  bot.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  console.error("unhandled rejection:", reason);
});

startDiscoveryDispatchCron(bot);

console.info("sigil starting...");
bot.start();
console.info("sigil is running");
