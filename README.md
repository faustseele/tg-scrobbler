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

## Deployment (Oracle Cloud / any VPS)

### On the server

```bash
# install deps
sudo apt-get install -y ffmpeg python3 curl
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# clone, build
git clone <your-repo-url> tg-scrobbler && cd tg-scrobbler
npm ci
npm run build
npm run db:migrate

# create .env with your keys
cp .env.example .env
# edit .env

# run
node --env-file=.env dist/index.js
```

### Keep it running (systemd)

```bash
sudo tee /etc/systemd/system/tg-scrobbler.service <<EOF
[Unit]
Description=tg-scrobbler telegram bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/tg-scrobbler
ExecStart=/usr/bin/node --env-file=.env dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now tg-scrobbler
```

## License

MIT
