const ptBr: Record<string, string> = {
  /** /start — primeira impressão, define o tom */
  "start.welcome":
    "Eu registro o que você ouve e garanto que a internet fique sabendo. Conecta um serviço e bora.",

  /** prompts genéricos */
  "common.connect_first":
    "Você não tá conectado a nada ainda. Tenta /login_lastfm, /login_librefm, ou /login_listenbrainz.",
  "common.no_lastfm":
    "Esse aqui precisa do Last.fm. Faz o /login_lastfm e volta.",
  "common.service_error":
    "Não consegui falar com o {service} agora. Tenta de novo em um instante.",

  /** /np */
  "np.nothing_playing":
    "Silêncio total. Vai colocar alguma coisa pra tocar.",
  "np.prefix":
    "\u{1F3A7}",

  /** /loved */
  "loved.header":
    "\u2764\uFE0F Faixas amadas:",
  "loved.empty":
    "Nada amado ainda. Você tá ouvindo sem se comprometer — escolha ousada.",

  /** /toplists */
  "toplists.choose_type":
    "Artistas, álbuns ou faixas — o que a gente tá vendo?",
  "toplists.choose_period":
    "Escolhe um período:",
  "toplists.no_data":
    "Nada pra mostrar nesse período. Você ficou em silêncio.",

  /** /random */
  "random.no_history":
    "Seu histórico tá meio ralo. Me alimenta mais.",
  "random.prefix":
    "\u{1F3B2}",

  /** /collage */
  "collage.generating":
    "Montando a grade de capas...",
  "collage.no_history":
    "Álbuns de menos pra preencher o grid. Continua ouvindo.",
  "collage.caption":
    "collage de álbuns de {username} — {period}",

  /** scrobble via áudio */
  "scrobble.no_connections":
    "Nenhum serviço conectado. Liga um com /login_lastfm, /login_librefm, ou /login_listenbrainz.",
  "scrobble.download_failed":
    "Não consegui baixar isso. Tenta de novo em um instante.",
  "scrobble.no_tags":
    "Sem tags legíveis nesse arquivo. Adiciona artista e título nos metadados e tenta de novo.",
  "scrobble.all_failed":
    "Todo serviço rejeitou: {failed}. Algo tá errado — confere suas conexões.",
  "scrobble.partial_failed":
    "Scrobblado, mas {failed} não aceitou.",

  /** fluxo OAuth / auth desktop */
  "auth.authorize_prompt":
    "Me autoriza no {service} e clica em Feito.\n\n<a href=\"{url}\">Abrir página de autorização do {service}</a>",
  "auth.done_button":
    "Feito",
  "auth.failed":
    "Auth falhou — parece que você não aprovou, ou a requisição expirou. Roda o comando de login de novo.",
  "auth.connected":
    "Conectado como <b>{name}</b> no {service}.",
  "auth.librefm_unconfigured":
    "O Libre.fm não tá configurado nessa instância. Usa /login_lastfm ou /login_listenbrainz.",

  /** fluxo de token ListenBrainz */
  "listenbrainz.paste_token":
    "Cola seu token de usuário do ListenBrainz e eu resolvo o resto.\n\nEncontra em <a href=\"https://listenbrainz.org/settings/\">listenbrainz.org/settings</a>",
  "listenbrainz.invalid_token":
    "Esse token não tá passando. Pega o certo nas configurações do ListenBrainz e tenta de novo.",
  "listenbrainz.no_username":
    "Token validado, mas o ListenBrainz não me deu um nome de usuário. Tenta de novo.",
  "listenbrainz.connected":
    "Vinculado como <b>{name}</b> no ListenBrainz. Pronto pra scrobblar.",
  "listenbrainz.unreachable":
    "Não consigo alcançar o ListenBrainz agora. Tenta de novo em um instante.",

  /** cron de digest semanal */
  "digest.header":
    "\u{1F4CA} Sua semana em música:",
  "digest.scrobble_count":
    "\u{1F3B5} {count} scrobbles essa semana",
  "digest.top_artists":
    "\u{1F3C6} Top artistas:",
  "digest.top_tracks":
    "\u{1F3B6} Top faixas:",

  /** cron de discovery */
  "discovery.caption":
    "\u{1F3B5} Discovery: <b>{artist}</b> \u2014 {track}",

  /** cron de notificações sociais */
  "shout.notification":
    "\u{1F4E3} Shout de <b>{author}</b>:",
};

export default ptBr;
