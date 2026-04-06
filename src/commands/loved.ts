import { Composer, Context } from "grammy";
import { lastfmConfig } from "../config.js";
import { getLovedTracks as getLastfmLovedTracks } from "../lastfm.js";
import { getLovedTracks as getListenbrainzLovedTracks } from "../listenbrainz.js";
import { resolveStatsConnection } from "../user-lookup.js";
import { escapeHtml } from "../utils.js";

const composer = new Composer<Context>();

/**
 * format a single loved track as an HTML list item —
 * wraps in an anchor when a URL is available, plain text otherwise
 */
function formatLovedTrackItem(
  index: number,
  track: { artist: string; track: string; trackUrl: string; lovedAt: string | null }
): string {
  const artist = escapeHtml(track.artist);
  const trackName = escapeHtml(track.track);
  const label = `${artist} — ${trackName}`;
  const dateSuffix = track.lovedAt ? `, ${escapeHtml(track.lovedAt)}` : "";

  if (track.trackUrl) {
    return `${index}. <a href="${track.trackUrl}">${label}</a>${dateSuffix}`;
  }

  return `${index}. ${label}${dateSuffix}`;
}

/**
 * /loved — show the user's most recently loved tracks,
 * checking Last.fm first then falling back to ListenBrainz
 */
composer.command("loved", async (context) => {
  const from = context.from;
  if (!from) {
    console.warn("/loved received with no from field");
    return;
  }

  const connection = await resolveStatsConnection(BigInt(from.id));

  if (!connection) {
    await context.reply(
      "Connect a service first with /login_lastfm, /login_librefm, or /login_listenbrainz"
    );
    return;
  }

  if (connection.service === "lastfm") {
    const tracks = await getLastfmLovedTracks(lastfmConfig, connection.serviceUsername);

    if (!tracks.length) {
      await context.reply("No loved tracks yet.");
      return;
    }

    const lines = tracks.map((track, index) => formatLovedTrackItem(index + 1, track));
    await context.reply(`\u{1F497} Loved tracks:\n${lines.join("\n")}`, { parse_mode: "HTML" });
    return;
  }

  if (connection.service === "listenbrainz") {
    const tracks = await getListenbrainzLovedTracks(connection.serviceUsername);

    if (!tracks.length) {
      await context.reply("No loved tracks yet.");
      return;
    }

    const lines = tracks.map((track, index) => formatLovedTrackItem(index + 1, track));
    await context.reply(`\u{1F497} Loved tracks:\n${lines.join("\n")}`, { parse_mode: "HTML" });
    return;
  }
});

export default composer;
