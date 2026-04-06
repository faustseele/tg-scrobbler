import { Composer, Context } from "grammy";
import { validateToken } from "../listenbrainz.js";
import { upsertUser, upsertServiceConnection } from "./scrobbler-auth.js";

/** telegram IDs currently waiting to paste their ListenBrainz token, with auto-expiry timers */
const pendingTokenInput = new Map<number, ReturnType<typeof setTimeout>>();

/** pending token input expires after 5 minutes */
const PENDING_TIMEOUT_MS = 5 * 60 * 1000;

function addPending(telegramId: number): void {
  clearPending(telegramId);
  const timer = setTimeout(() => pendingTokenInput.delete(telegramId), PENDING_TIMEOUT_MS);
  pendingTokenInput.set(telegramId, timer);
}

function clearPending(telegramId: number): void {
  const existing = pendingTokenInput.get(telegramId);
  if (existing) clearTimeout(existing);
  pendingTokenInput.delete(telegramId);
}

const SETTINGS_URL = "https://listenbrainz.org/settings/";
const SERVICE_TYPE = "listenbrainz";

const composer = new Composer<Context>();

/**
 * /login_listenbrainz — prompt the user to paste their API token.
 * ListenBrainz uses a simple bearer token, not OAuth
 */
composer.command("login_listenbrainz", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("login_listenbrainz received update with no from field");
    return;
  }

  addPending(from.id);

  await context.reply(
    `Paste your ListenBrainz user token and I'll take it from there.\n\nFind it at <a href="${SETTINGS_URL}">listenbrainz.org/settings</a>`,
    { parse_mode: "HTML" }
  );
});

/**
 * text message handler — intercepts the token when the user is in the pending set.
 * validates against the ListenBrainz API, then persists the connection
 */
composer.on("message:text", async (context) => {
  const from = context.from;
  if (!from) return;

  const isPending = pendingTokenInput.has(from.id);
  if (!isPending) return;

  clearPending(from.id);

  const token = context.message.text.trim();

  let validationResult: { valid: boolean; userName: string | null };
  try {
    validationResult = await validateToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`validateToken failed for telegramId=${from.id}: ${message}`);
    await context.reply("Couldn't reach ListenBrainz right now. Try again in a moment.");
    /** re-add so the user can retry without re-issuing the command */
    addPending(from.id);
    return;
  }

  if (!validationResult.valid) {
    await context.reply(
      "That token doesn't look right. Check your ListenBrainz settings and try again.",
      { parse_mode: "HTML" }
    );
    return;
  }

  const userName = validationResult.userName;
  if (!userName) {
    console.warn(`validateToken returned valid but no userName for telegramId=${from.id}`);
    await context.reply("Token validated but ListenBrainz didn't return a username. Try again.");
    return;
  }

  const userId = await upsertUser(BigInt(from.id), from.language_code);
  await upsertServiceConnection(userId, SERVICE_TYPE, token, userName);

  await context.reply(
    `Linked as <b>${userName}</b> on ListenBrainz. Ready to scrobble.`,
    { parse_mode: "HTML" }
  );
});

export default composer;
