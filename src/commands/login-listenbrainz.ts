import { Composer, Context } from "grammy";
import { t } from "../i18n/index.js";
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

  const lang = context.from?.language_code ?? "en";
  addPending(from.id);

  await context.reply(
    t("listenbrainz.paste_token", lang),
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

  const lang = context.from?.language_code ?? "en";
  const token = context.message.text.trim();

  let validationResult: { valid: boolean; userName: string | null };
  try {
    validationResult = await validateToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`validateToken failed for telegramId=${from.id}: ${message}`);
    await context.reply(t("listenbrainz.unreachable", lang));
    /** re-add so the user can retry without re-issuing the command */
    addPending(from.id);
    return;
  }

  if (!validationResult.valid) {
    await context.reply(
      t("listenbrainz.invalid_token", lang),
      { parse_mode: "HTML" }
    );
    return;
  }

  const userName = validationResult.userName;
  if (!userName) {
    console.warn(`validateToken returned valid but no userName for telegramId=${from.id}`);
    await context.reply(t("listenbrainz.no_username", lang));
    return;
  }

  const userId = await upsertUser(BigInt(from.id), from.language_code);
  await upsertServiceConnection(userId, SERVICE_TYPE, token, userName);

  await context.reply(
    t("listenbrainz.connected", lang, { name: userName }),
    { parse_mode: "HTML" }
  );
});

export default composer;
