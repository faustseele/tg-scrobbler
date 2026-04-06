import { Composer, Context } from "grammy";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { getToken, getSession, getAuthUrl, LastfmConfig } from "../lastfm.js";

/** params for creating a service-specific auth composer */
export interface ScrobblerAuthFactoryParams {
  config: LastfmConfig;
  /** stored in the DB service_connections.service_type column */
  serviceType: string;
  /** shown to the user in messages, e.g. "Last.fm" or "Libre.fm" */
  serviceName: string;
  /** telegram command name without leading slash, e.g. "login_lastfm" */
  commandName: string;
  /** prefix for callback_data, e.g. "lastfm_auth_done" */
  callbackPrefix: string;
}

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
  serviceType: string,
  sessionKey: string,
  serviceUsername: string
): Promise<void> {
  await db
    .insert(serviceConnections)
    .values({
      userId,
      serviceType,
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
 * creates a grammY Composer with a command handler and a callback handler
 * for the Audioscrobbler desktop auth flow, parameterised per service
 */
export function createScrobblerAuthComposer(
  params: ScrobblerAuthFactoryParams
): Composer<Context> {
  const { config, serviceType, serviceName, commandName, callbackPrefix } = params;

  const composer = new Composer<Context>();

  const callbackPattern = new RegExp(`^${callbackPrefix}:(.+)$`);

  /**
   * /${commandName} — kick off the desktop auth flow.
   * gets a temp token, links it to the user record, and hands the user
   * an auth URL with a "Done" button to confirm when they've approved
   */
  composer.command(commandName, async (context) => {
    const from = context.from;
    if (!from) {
      console.warn(`${commandName} received update with no from field`);
      return;
    }

    let token: string;
    try {
      token = await getToken(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`getToken failed for telegramId=${from.id} service=${serviceType}: ${message}`);
      await context.reply(`Couldn't reach ${serviceName} right now. Try again in a moment.`);
      return;
    }

    await upsertUser(BigInt(from.id), from.language_code);

    const authUrl = getAuthUrl(config, token);

    await context.reply(
      `Authorise me on ${serviceName}, then hit Done.\n\n<a href="${authUrl}">Open ${serviceName} auth page</a>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Done", callback_data: `${callbackPrefix}:${token}` }],
          ],
        },
      }
    );
  });

  /**
   * callback handler for the "Done" button — exchanges the token for a session
   * and saves the connection, or tells the user if they haven't approved yet
   */
  composer.callbackQuery(callbackPattern, async (context) => {
    const from = context.from;
    const token = context.match[1];

    await context.answerCallbackQuery();

    let session: { name: string; key: string };
    try {
      session = await getSession(config, token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`getSession failed for telegramId=${from.id} service=${serviceType} token=${token}: ${message}`);
      await context.editMessageText(
        `Auth failed — looks like you didn't approve the request, or it expired. Run /${commandName} again.`
      );
      return;
    }

    const userId = await upsertUser(BigInt(from.id), from.language_code);
    await upsertServiceConnection(userId, serviceType, session.key, session.name);

    await context.editMessageText(
      `Connected as <b>${session.name}</b> on ${serviceName}.`,
      { parse_mode: "HTML" }
    );
  });

  return composer;
}
