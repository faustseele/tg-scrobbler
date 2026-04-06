import { Composer } from "grammy";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { getToken, getSession, getAuthUrl, LastfmConfig } from "../lastfm.js";

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

const composer = new Composer();

/**
 * upsert a user row by telegram ID — creates on first encounter, no-ops on repeat.
 * returns the internal numeric user ID
 */
async function upsertUser(
  telegramId: bigint,
  language: string | undefined
): Promise<number> {
  const result = await db
    .insert(users)
    .values({
      telegramId,
      language: language ?? "en",
    })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: { language: language ?? "en" },
    })
    .returning({ id: users.id });

  const row = result[0];
  if (!row) {
    console.error(`upsertUser returned empty result for telegramId=${telegramId}`);
    throw new Error("failed to upsert user");
  }

  return row.id;
}

/**
 * upsert a service_connections row — replaces authToken & serviceUsername when
 * the user reconnects the same service
 */
async function upsertServiceConnection(
  userId: number,
  sessionKey: string,
  serviceUsername: string
): Promise<void> {
  await db
    .insert(serviceConnections)
    .values({
      userId,
      serviceType: "lastfm",
      authToken: sessionKey,
      serviceUsername,
    })
    .onConflictDoUpdate({
      target: [serviceConnections.userId, serviceConnections.serviceType],
      set: {
        authToken: sessionKey,
        serviceUsername,
      },
    });
}

/**
 * /login_lastfm — kick off the Last.fm desktop auth flow.
 * gets a temp token, links it to the user record, and hands the user
 * an auth URL with a "Done" button to confirm when they've approved
 */
composer.command("login_lastfm", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("login_lastfm received update with no from field");
    return;
  }

  let token: string;
  try {
    token = await getToken(lastfmConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`getToken failed for telegramId=${from.id}: ${message}`);
    await context.reply("Couldn't reach Last.fm right now. Try again in a moment.");
    return;
  }

  await upsertUser(BigInt(from.id), from.language_code);

  const authUrl = getAuthUrl(lastfmConfig, token);

  await context.reply(
    `Authorise me on Last.fm, then hit Done.\n\n<a href="${authUrl}">Open Last.fm auth page</a>`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Done", callback_data: `lastfm_auth_done:${token}` }],
        ],
      },
    }
  );
});

/**
 * callback handler for the "Done" button — exchanges the token for a session
 * and saves the connection, or tells the user if they haven't approved yet
 */
composer.callbackQuery(/^lastfm_auth_done:(.+)$/, async (context) => {
  const from = context.from;
  const token = context.match[1];

  await context.answerCallbackQuery();

  let session: { name: string; key: string };
  try {
    session = await getSession(lastfmConfig, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`getSession failed for telegramId=${from.id}, token=${token}: ${message}`);
    await context.editMessageText(
      "Auth failed — looks like you didn't approve the request, or it expired. Run /login_lastfm again."
    );
    return;
  }

  const userId = await upsertUser(BigInt(from.id), from.language_code);
  await upsertServiceConnection(userId, session.key, session.name);

  await context.editMessageText(
    `Connected as <b>${session.name}</b> on Last.fm.`,
    { parse_mode: "HTML" }
  );
});

export default composer;
