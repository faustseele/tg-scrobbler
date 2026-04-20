import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "./db.js";
import { users, serviceConnections } from "./schema.js";

/** user row with Last.fm connection details */
export interface LastfmConnectedUser {
  userId: number;
  telegramId: bigint;
  serviceUsername: string;
  language: string | null;
}

/**
 * fetch all users who have an active Last.fm connection with a known username.
 * used by cron jobs that need to iterate all Last.fm users.
 */
export async function fetchLastfmConnectedUsers(): Promise<LastfmConnectedUser[]> {
  const rows = await db
    .select({
      userId: users.id,
      telegramId: users.telegramId,
      serviceUsername: serviceConnections.serviceUsername,
      language: users.language,
    })
    .from(users)
    .innerJoin(
      serviceConnections,
      and(
        eq(serviceConnections.userId, users.id),
        eq(serviceConnections.serviceType, "lastfm")
      )
    )
    .where(isNotNull(serviceConnections.serviceUsername));

  return rows.filter(
    (row): row is LastfmConnectedUser => row.serviceUsername !== null
  );
}

interface UserConnection {
  userId: number;
  serviceUsername: string;
}

/**
 * find the user's connection for a given service type.
 * returns null if the user doesn't exist or has no connection of that type.
 */
async function findConnection(
  telegramId: bigint,
  serviceType: string
): Promise<UserConnection | null> {
  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  const user = userRow[0];
  if (!user) return null;

  const connectionRow = await db
    .select({ serviceUsername: serviceConnections.serviceUsername })
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.userId, user.id),
        eq(serviceConnections.serviceType, serviceType)
      )
    )
    .limit(1);

  const connection = connectionRow[0];
  if (!connection?.serviceUsername) return null;

  return { userId: user.id, serviceUsername: connection.serviceUsername };
}

/**
 * resolve a Last.fm connection specifically.
 * returns null if the user has no Last.fm connection.
 */
export async function resolveLastfmConnection(
  telegramId: bigint
): Promise<{ userId: number; serviceUsername: string } | null> {
  return findConnection(telegramId, "lastfm");
}
