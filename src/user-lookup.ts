import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "./db.js";
import { users, serviceConnections } from "./schema.js";

/** user row with Last.fm connection details */
export interface LastfmConnectedUser {
  userId: number;
  telegramId: bigint;
  serviceUsername: string;
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
 * resolve the best available stats connection for a telegram user.
 * tries Last.fm first, then ListenBrainz. returns the connection
 * and which service it came from, or null if neither exists.
 */
export async function resolveStatsConnection(
  telegramId: bigint
): Promise<{ service: "lastfm" | "listenbrainz"; userId: number; serviceUsername: string } | null> {
  const lastfm = await findConnection(telegramId, "lastfm");
  if (lastfm) {
    return { service: "lastfm", ...lastfm };
  }

  const listenbrainz = await findConnection(telegramId, "listenbrainz");
  if (listenbrainz) {
    return { service: "listenbrainz", ...listenbrainz };
  }

  return null;
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
