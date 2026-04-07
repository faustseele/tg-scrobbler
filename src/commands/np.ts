import { Composer, Context } from "grammy";
import { lastfmConfig } from "../config.js";
import { getRecentTrack as getLastfmRecentTrack } from "../lastfm.js";
import { getRecentTrack as getListenbrainzRecentTrack } from "../listenbrainz.js";
import { resolveStatsConnection } from "../user-lookup.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";

const composer = new Composer<Context>();

/**
 * format a RecentTrack into the HTML reply string for /np
 */
function formatNowPlayingReply(
  track: {
    artist: string;
    track: string;
    album: string;
    trackUrl: string;
    isNowPlaying: boolean;
    timestamp: string | null;
  },
  lang: string
): string {
  const artist = escapeHtml(track.artist);
  const trackName = escapeHtml(track.track);
  const album = escapeHtml(track.album);
  const escapedUrl = escapeHtml(track.trackUrl);
  const prefix = t("np.prefix", lang);

  const albumSuffix = album ? ` [${album}]` : "";
  const link = `<a href="${escapedUrl}">${escapedUrl}</a>`;

  if (track.isNowPlaying) {
    return `${prefix} <b>${artist}</b> \u2014 ${trackName}${albumSuffix}\n${link}`;
  }

  const timestampSuffix = track.timestamp ? `, ${escapeHtml(track.timestamp)}` : "";
  return `${prefix} <b>${artist}</b> \u2014 ${trackName}${albumSuffix}${timestampSuffix}\n${link}`;
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

  const lang = from.language_code ?? "en";
  const connection = await resolveStatsConnection(BigInt(from.id));

  if (!connection) {
    await context.reply(t("common.connect_first", lang));
    return;
  }

  const { service, serviceUsername } = connection;

  if (service === "lastfm") {
    const recentTrack = await getLastfmRecentTrack(lastfmConfig, serviceUsername);

    if (!recentTrack) {
      await context.reply(t("np.nothing_playing", lang));
      return;
    }

    await context.reply(formatNowPlayingReply(recentTrack, lang), { parse_mode: "HTML" });
    return;
  }

  if (service === "listenbrainz") {
    const recentTrack = await getListenbrainzRecentTrack(serviceUsername);

    if (!recentTrack) {
      await context.reply(t("np.nothing_playing", lang));
      return;
    }

    await context.reply(formatNowPlayingReply(recentTrack, lang), { parse_mode: "HTML" });
  }
});

export default composer;
