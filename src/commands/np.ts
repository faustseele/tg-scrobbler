import { Composer, Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { lastfmConfig } from "../config.js";
import { getRecentTrack as getLastfmRecentTrack } from "../lastfm.js";
import { getRecentTrack as getListenbrainzRecentTrack } from "../listenbrainz.js";

const composer = new Composer<Context>();

/**
 * escape characters that have special meaning in Telegram HTML parse mode
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * format a RecentTrack into the HTML reply string for /np
 */
function formatNowPlayingReply(track: {
  artist: string;
  track: string;
  album: string;
  trackUrl: string;
  isNowPlaying: boolean;
  timestamp: string | null;
}): string {
  const artist = escapeHtml(track.artist);
  const trackName = escapeHtml(track.track);
  const album = escapeHtml(track.album);

  const albumSuffix = album ? ` [${album}]` : "";

  if (track.isNowPlaying) {
    return `🎧 <b>${artist}</b> — ${trackName}${albumSuffix}\n${track.trackUrl}`;
  }

  const timestampSuffix = track.timestamp ? `, ${escapeHtml(track.timestamp)}` : "";
  return `🎧 <b>${artist}</b> — ${trackName}${albumSuffix}${timestampSuffix}\n${track.trackUrl}`;
}

/**
 * /np — show what the user is currently playing or last played,
 * checking Last.fm first then falling back to ListenBrainz
 */
composer.command("np", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("/np received with no from field");
    return;
  }

  const telegramId = BigInt(from.id);

  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  const user = userRow[0];
  if (!user) {
    await context.reply(
      "Connect a service first with /login_lastfm, /login_librefm, or /login_listenbrainz"
    );
    return;
  }

  const lastfmRow = await db
    .select({ serviceUsername: serviceConnections.serviceUsername })
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.userId, user.id),
        eq(serviceConnections.serviceType, "lastfm")
      )
    )
    .limit(1);

  const lastfmConnection = lastfmRow[0];

  if (lastfmConnection) {
    const serviceUsername = lastfmConnection.serviceUsername;
    if (!serviceUsername) {
      console.warn(`/np — Last.fm connection for userId=${user.id} has no serviceUsername`);
      await context.reply("Something went wrong with your Last.fm connection. Try reconnecting.");
      return;
    }

    const recentTrack = await getLastfmRecentTrack(lastfmConfig, serviceUsername);

    if (!recentTrack) {
      await context.reply("Nothing playing right now.");
      return;
    }

    await context.reply(formatNowPlayingReply(recentTrack), { parse_mode: "HTML" });
    return;
  }

  const listenbrainzRow = await db
    .select({ serviceUsername: serviceConnections.serviceUsername })
    .from(serviceConnections)
    .where(
      and(
        eq(serviceConnections.userId, user.id),
        eq(serviceConnections.serviceType, "listenbrainz")
      )
    )
    .limit(1);

  const listenbrainzConnection = listenbrainzRow[0];

  if (!listenbrainzConnection) {
    await context.reply(
      "Connect a service first with /login_lastfm, /login_librefm, or /login_listenbrainz"
    );
    return;
  }

  const serviceUsername = listenbrainzConnection.serviceUsername;
  if (!serviceUsername) {
    console.warn(`/np — ListenBrainz connection for userId=${user.id} has no serviceUsername`);
    await context.reply("Something went wrong with your ListenBrainz connection. Try reconnecting.");
    return;
  }

  const recentTrack = await getListenbrainzRecentTrack(serviceUsername);

  if (!recentTrack) {
    await context.reply("Nothing playing right now.");
    return;
  }

  await context.reply(formatNowPlayingReply(recentTrack), { parse_mode: "HTML" });
});

export default composer;
