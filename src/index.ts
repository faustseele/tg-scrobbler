import { Bot } from "grammy";
import { t } from "./i18n/index.js";
import loginLastfm from "./commands/login-lastfm.js";
import loginLibrefm from "./commands/login-librefm.js";
import loginListenbrainz from "./commands/login-listenbrainz.js";
import scrobble from "./commands/scrobble.js";
import np from "./commands/np.js";
import loved from "./commands/loved.js";
import toplists from "./commands/toplists.js";
import random from "./commands/random.js";
import collage from "./commands/collage.js";
import { startWeeklyDigestCron } from "./cron/weekly-digest.js";
import { startDiscoveryDispatchCron } from "./cron/discovery-dispatch.js";
import { startSocialNotificationsCron } from "./cron/social-notifications.js";

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
bot.use(np);
bot.use(loved);
bot.use(toplists);
bot.use(random);
bot.use(collage);

const shutdown = () => {
  bot.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

process.on("unhandledRejection", (reason) => {
  console.error("unhandled rejection:", reason);
});

startWeeklyDigestCron(bot);
startDiscoveryDispatchCron(bot);
startSocialNotificationsCron(bot);

console.info("tg-scrobbler starting...");
bot.start();
console.info("tg-scrobbler is running");
