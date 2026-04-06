import { Composer, Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { users, serviceConnections } from "../schema.js";
import { lastfmConfig } from "../config.js";
import { getLovedTracks as getLastfmLovedTracks } from "../lastfm.js";
import { getLovedTracks as getListenbrainzLovedTracks } from "../listenbrainz.js";

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
      console.warn(`/loved — Last.fm connection for userId=${user.id} has no serviceUsername`);
      await context.reply("Something went wrong with your Last.fm connection. Try reconnecting.");
      return;
    }

    const tracks = await getLastfmLovedTracks(lastfmConfig, serviceUsername);

    if (!tracks.length) {
      await context.reply("No loved tracks yet.");
      return;
    }

    const lines = tracks.map((track, index) => formatLovedTrackItem(index + 1, track));
    await context.reply(`\u{1F497} Loved tracks:\n${lines.join("\n")}`, { parse_mode: "HTML" });
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
    console.warn(`/loved — ListenBrainz connection for userId=${user.id} has no serviceUsername`);
    await context.reply("Something went wrong with your ListenBrainz connection. Try reconnecting.");
    return;
  }

  const tracks = await getListenbrainzLovedTracks(serviceUsername);

  if (!tracks.length) {
    await context.reply("No loved tracks yet.");
    return;
  }

  const lines = tracks.map((track, index) => formatLovedTrackItem(index + 1, track));
  await context.reply(`\u{1F497} Loved tracks:\n${lines.join("\n")}`, { parse_mode: "HTML" });
});

export default composer;
