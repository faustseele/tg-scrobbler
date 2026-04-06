import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { serviceConnections, scrobbleCache } from "./schema.js";
import { scrobbleTrack, LastfmConfig } from "./lastfm.js";
import { submitListen } from "./listenbrainz.js";

export interface ScrobbleParams {
  userId: number;
  artist: string;
  track: string;
  album: string | null;
  timestamp: number;
}

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

const librefmApiKey = process.env.LIBREFM_API_KEY;
const librefmSharedSecret = process.env.LIBREFM_SHARED_SECRET;

let librefmConfig: LastfmConfig | null = null;

if (!librefmApiKey || !librefmSharedSecret) {
  console.info("LIBREFM_API_KEY or LIBREFM_SHARED_SECRET not set — Libre.fm scrobbling will be skipped");
} else {
  librefmConfig = {
    apiKey: librefmApiKey,
    sharedSecret: librefmSharedSecret,
    apiUrl: "https://libre.fm/2.0/",
    authUrl: "https://libre.fm/api/auth/",
  };
}

/** result shape for a single service submission attempt */
interface ServiceSubmissionResult {
  serviceType: string;
  succeeded: boolean;
}

/**
 * submit a single scrobble to all services the user has connected,
 * then cache the scrobble regardless of service outcomes
 */
export async function submitScrobble(
  params: ScrobbleParams
): Promise<{ succeeded: string[]; failed: string[] }> {
  const { userId, artist, track, album, timestamp } = params;

  const connections = await db
    .select({
      serviceType: serviceConnections.serviceType,
      authToken: serviceConnections.authToken,
    })
    .from(serviceConnections)
    .where(eq(serviceConnections.userId, userId));

  const albumArg = album ?? undefined;

  const submissionPromises = connections.map(
    async (connection): Promise<ServiceSubmissionResult> => {
      const { serviceType, authToken } = connection;

      try {
        if (serviceType === "lastfm") {
          await scrobbleTrack(lastfmConfig, authToken, artist, track, timestamp, albumArg);
          console.info(`scrobble submitted to Last.fm for userId=${userId} track="${track}"`);
        } else if (serviceType === "librefm") {
          if (!librefmConfig) {
            console.warn(`skipping Libre.fm scrobble for userId=${userId} — config not available`);
            return { serviceType, succeeded: false };
          }
          await scrobbleTrack(librefmConfig, authToken, artist, track, timestamp, albumArg);
          console.info(`scrobble submitted to Libre.fm for userId=${userId} track="${track}"`);
        } else if (serviceType === "listenbrainz") {
          await submitListen(authToken, artist, track, timestamp, albumArg);
          console.info(`scrobble submitted to ListenBrainz for userId=${userId} track="${track}"`);
        } else {
          console.warn(`unknown serviceType "${serviceType}" for userId=${userId} — skipping`);
          return { serviceType, succeeded: false };
        }

        return { serviceType, succeeded: true };
      } catch (submissionError) {
        const message = submissionError instanceof Error ? submissionError.message : String(submissionError);
        console.error(`scrobble failed for serviceType="${serviceType}" userId=${userId}: ${message}`);
        return { serviceType, succeeded: false };
      }
    }
  );

  const settlementResults = await Promise.allSettled(submissionPromises);

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const settlementResult of settlementResults) {
    if (settlementResult.status === "fulfilled") {
      const { serviceType, succeeded: didSucceed } = settlementResult.value;
      if (didSucceed) {
        succeeded.push(serviceType);
      } else {
        failed.push(serviceType);
      }
    } else {
      /** Promise.allSettled only rejects if the inner promise itself throws,
       *  which shouldn't happen given the try/catch above — log defensively */
      console.error(`unexpected rejection in service submission: ${String(settlementResult.reason)}`);
    }
  }

  await db.insert(scrobbleCache).values({
    userId,
    artist,
    track,
    album,
  });

  return { succeeded, failed };
}
