import { Composer, Context } from "grammy";
import { lastfmConfig } from "../config.js";
import { getRecentTrack as getLastfmRecentTrack } from "../lastfm.js";
import { getRecentTrack as getListenbrainzRecentTrack } from "../listenbrainz.js";
import { resolveStatsConnection } from "../user-lookup.js";
import { escapeHtml } from "../utils.js";

const composer = new Composer<Context>();

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

  const connection = await resolveStatsConnection(BigInt(from.id));

  if (!connection) {
    await context.reply(
      "Connect a service first with /login_lastfm, /login_librefm, or /login_listenbrainz"
    );
    return;
  }

  const { service, serviceUsername } = connection;

  if (service === "lastfm") {
    const recentTrack = await getLastfmRecentTrack(lastfmConfig, serviceUsername);

    if (!recentTrack) {
      await context.reply("Nothing playing right now.");
      return;
    }

    await context.reply(formatNowPlayingReply(recentTrack), { parse_mode: "HTML" });
    return;
  }

  if (service === "listenbrainz") {
    const recentTrack = await getListenbrainzRecentTrack(serviceUsername);

    if (!recentTrack) {
      await context.reply("Nothing playing right now.");
      return;
    }

    await context.reply(formatNowPlayingReply(recentTrack), { parse_mode: "HTML" });
  }
});

export default composer;
