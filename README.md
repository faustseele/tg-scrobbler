# sigil

A Telegram bot with two scrobble paths — audio you send gets auto-scrobbled, and a daily morning recommendation arrives with a one-click scrobble button. Connects to Last.fm, Libre.fm, and ListenBrainz.

## What it does

- **Auto-scrobble** — send a tagged audio file, it's logged to every connected service
- **Daily recommendation** — every morning, a track you haven't heard arrives as audio with a "Scrobble this" button
- **Roulette** — `/roulette` pulls a random loved track from your history and sends it as audio, one click to scrobble again
- **Album collage** — `/collage` with inline time-frame picker (month / 3 months / year)
- **Multi-service** — Last.fm, Libre.fm, ListenBrainz
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
git clone <your-repo-url> sigil && cd sigil
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
sudo tee /etc/systemd/system/sigil.service <<EOF
[Unit]
Description=sigil telegram bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/sigil
ExecStart=/usr/bin/node --env-file=.env dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now sigil
```

## License

MIT
