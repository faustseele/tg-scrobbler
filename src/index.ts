import { Bot } from "grammy";
import loginLastfm from "./commands/login-lastfm.js";
import loginLibrefm from "./commands/login-librefm.js";
import loginListenbrainz from "./commands/login-listenbrainz.js";

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error("BOT_TOKEN is not set");
}

const bot = new Bot(botToken);

bot.command("start", (context) => {
  return context.reply(
    "Your listening history, in your pocket. I track what you play and scrobble it to Last.fm — no fuss.\n\nType /help to see what I can do."
  );
});

bot.use(loginLastfm);
bot.use(loginLibrefm);
bot.use(loginListenbrainz);

const shutdown = () => {
  bot.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

bot.start();
