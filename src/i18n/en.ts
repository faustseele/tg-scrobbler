const en: Record<string, string> = {
  /** /start — first impression, sets the tone */
  "start.welcome":
    "I track what you listen to and make sure the internet knows about it. Connect a service and let's get to work.",

  /** generic prompts */
  "common.connect_first":
    "You're not connected to anything yet. Try /login_lastfm, /login_librefm, or /login_listenbrainz.",
  "common.no_lastfm":
    "This one needs Last.fm. /login_lastfm and come back.",
  "common.service_error":
    "Couldn't reach {service} right now. Try again in a moment.",

  /** /collage */
  "collage.generating":
    "Pulling the art together...",
  "collage.no_history":
    "Not enough albums to fill the grid. Keep listening.",
  "collage.caption":
    "{username}'s {period} album collage",

  /** audio scrobbling */
  "scrobble.no_connections":
    "No services connected. Hook one up with /login_lastfm, /login_librefm, or /login_listenbrainz.",
  "scrobble.download_failed":
    "Couldn't download that. Try again in a moment.",
  "scrobble.no_tags":
    "No readable tags on this file. Add artist and title metadata and try again.",
  "scrobble.all_failed":
    "Every service rejected it: {failed}. Something's off — check your connections.",
  "scrobble.partial_failed":
    "Scrobbled, but {failed} didn't take it.",

  /** OAuth / desktop auth flow */
  "auth.authorize_prompt":
    "Authorize me on {service}, then hit Done.\n\n<a href=\"{url}\">Open {service} auth page</a>",
  "auth.done_button":
    "Done",
  "auth.failed":
    "Auth failed — looks like you didn't approve it, or the request expired. Run the login command again.",
  "auth.connected":
    "Connected as <b>{name}</b> on {service}.",
  "auth.librefm_unconfigured":
    "Libre.fm isn't configured on this instance. Use /login_lastfm or /login_listenbrainz instead.",

  /** ListenBrainz token flow */
  "listenbrainz.paste_token":
    "Paste your ListenBrainz user token and I'll handle the rest.\n\nFind it at <a href=\"https://listenbrainz.org/settings/\">listenbrainz.org/settings</a>",
  "listenbrainz.invalid_token":
    "That token doesn't check out. Grab the right one from your ListenBrainz settings and try again.",
  "listenbrainz.no_username":
    "Token validated, but ListenBrainz didn't give me a username. Try again.",
  "listenbrainz.connected":
    "Linked as <b>{name}</b> on ListenBrainz. Ready to scrobble.",
  "listenbrainz.unreachable":
    "Can't reach ListenBrainz right now. Try again in a moment.",

  /** discovery dispatch cron */
  "discovery.caption":
    "\u{1F3B5} Discovery: <b>{artist}</b> \u2014 {track}",

  /** scrobble button on discovery messages */
  "recommendation.scrobble_button": "Scrobble this",
  "recommendation.scrobbled": "\u2713 Scrobbled",
  "recommendation.already_scrobbled": "Already scrobbled.",
  "recommendation.not_yours": "That's not your button.",
};

export default en;
