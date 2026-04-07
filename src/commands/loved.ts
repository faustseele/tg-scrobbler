import { Composer, Context } from "grammy";
import { lastfmConfig } from "../config.js";
import { getLovedTracks as getLastfmLovedTracks } from "../lastfm.js";
import { getLovedTracks as getListenbrainzLovedTracks } from "../listenbrainz.js";
import { resolveStatsConnection } from "../user-lookup.js";
import { escapeHtml } from "../utils.js";
import { t } from "../i18n/index.js";

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
  const dateSuffix = track.lovedAt ? `, ${escapeHtml(track.lovedAt)}` : "";

  if (track.trackUrl) {
    return `${index}. <b>${artist}</b> \u2014 <a href="${track.trackUrl}">${trackName}</a>${dateSuffix}`;
  }

  return `${index}. <b>${artist}</b> \u2014 ${trackName}${dateSuffix}`;
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

  const lang = from.language_code ?? "en";
  const connection = await resolveStatsConnection(BigInt(from.id));

  if (!connection) {
    await context.reply(t("common.connect_first", lang));
    return;
  }

  if (connection.service === "lastfm") {
    const tracks = await getLastfmLovedTracks(lastfmConfig, connection.serviceUsername);

    if (!tracks.length) {
      await context.reply(t("loved.empty", lang));
      return;
    }

    const lines = tracks.map((track, index) => formatLovedTrackItem(index + 1, track));
    await context.reply(`${t("loved.header", lang)}\n${lines.join("\n")}`, { parse_mode: "HTML" });
    return;
  }

  if (connection.service === "listenbrainz") {
    const tracks = await getListenbrainzLovedTracks(connection.serviceUsername);

    if (!tracks.length) {
      await context.reply(t("loved.empty", lang));
      return;
    }

    const lines = tracks.map((track, index) => formatLovedTrackItem(index + 1, track));
    await context.reply(`${t("loved.header", lang)}\n${lines.join("\n")}`, { parse_mode: "HTML" });
    return;
  }
});

export default composer;
