# tg-scrobbler

A Telegram bot that scrobbles audio you send it — and doubles as a sharp-witted Last.fm companion.

## What it does

- **Scrobble audio** — send a tagged audio file, it gets scrobbled to your connected services
- **Multi-service** — Last.fm, Libre.fm, ListenBrainz
- **Stats** — now playing, loved tracks, top lists, album collages, random picks
- **Weekly digest** — auto-generated summary of your top scrobbles with commentary
- **Song discovery** — twice a week, get a track you've never heard delivered as audio
- **Social notifications** — Last.fm shouts and messages forwarded to Telegram
- **Localized** — EN, RU, PT-BR personality lines

## Setup

```bash
cp .env.example .env
# fill in your keys
npm install
npm run dev
```

### Required env vars

| Variable | Source |
|---|---|
| `BOT_TOKEN` | [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | [Neon](https://neon.tech) postgres connection string |
| `LASTFM_API_KEY` | [Last.fm API](https://www.last.fm/api/account/create) |
| `LASTFM_SHARED_SECRET` | Same as above |

### Database

```bash
npm run db:migrate
```

## Stack

TypeScript, Node.js, [grammY](https://grammy.dev), [Drizzle ORM](https://orm.drizzle.team), PostgreSQL (Neon)

## License

MIT
