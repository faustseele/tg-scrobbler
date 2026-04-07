const ru: Record<string, string> = {
  /** /start — первое впечатление, задаёт тон */
  "start.welcome":
    "Слежу за тем, что ты слушаешь, и докладываю интернету. Подключи сервис — и поехали.",

  /** общие подсказки */
  "common.connect_first":
    "Ни к чему не подключён. Попробуй /login_lastfm, /login_librefm или /login_listenbrainz.",
  "common.no_lastfm":
    "Это требует Last.fm. Сначала /login_lastfm, потом возвращайся.",
  "common.service_error":
    "Не достучаться до {service} прямо сейчас. Попробуй чуть позже.",

  /** /np */
  "np.nothing_playing":
    "Тишина. Поставь что-нибудь.",
  "np.prefix":
    "\u{1F3A7}",

  /** /loved */
  "loved.header":
    "\u2764\uFE0F Залюбленные треки:",
  "loved.empty":
    "Ещё ничего не залюблено. Слушаешь и не фиксируешь — смелый подход.",

  /** /toplists */
  "toplists.choose_type":
    "Исполнители, альбомы или треки — что смотрим?",
  "toplists.choose_period":
    "Выбери период:",
  "toplists.no_data":
    "Нечего показать за этот период. Что-то ты притих.",

  /** /random */
  "random.no_history":
    "Библиотека жидковата. Покорми меня больше.",
  "random.prefix":
    "\u{1F3B2}",

  /** /collage */
  "collage.generating":
    "Собираю обложки...",
  "collage.no_history":
    "Альбомов не хватает для коллажа. Слушай дальше.",
  "collage.caption":
    "Коллаж {username} за {period}",

  /** скробблинг аудио */
  "scrobble.no_connections":
    "Ни один сервис не подключён. Исправь это через /login_lastfm, /login_librefm или /login_listenbrainz.",
  "scrobble.download_failed":
    "Не удалось скачать. Попробуй ещё раз.",
  "scrobble.no_tags":
    "Теги не читаются. Добавь исполнителя и название в метаданные и попробуй снова.",
  "scrobble.all_failed":
    "Все сервисы отклонили: {failed}. Что-то не так — проверь подключения.",
  "scrobble.partial_failed":
    "Заскробблено, но {failed} не принял.",

  /** OAuth / авторизация */
  "auth.authorize_prompt":
    "Авторизуй меня на {service}, потом жми Готово.\n\n<a href=\"{url}\">Открыть страницу авторизации {service}</a>",
  "auth.done_button":
    "Готово",
  "auth.failed":
    "Авторизация не прошла — похоже, ты не подтвердил или запрос истёк. Запусти команду входа заново.",
  "auth.connected":
    "Подключён как <b>{name}</b> на {service}.",
  "auth.librefm_unconfigured":
    "Libre.fm не настроен на этом сервере. Используй /login_lastfm или /login_listenbrainz.",

  /** привязка ListenBrainz токена */
  "listenbrainz.paste_token":
    "Вставь свой ListenBrainz user token, дальше разберусь сам.\n\nНайти его можно на <a href=\"https://listenbrainz.org/settings/\">listenbrainz.org/settings</a>",
  "listenbrainz.invalid_token":
    "Токен не подходит. Возьми правильный из настроек ListenBrainz и попробуй снова.",
  "listenbrainz.no_username":
    "Токен принят, но ListenBrainz не дал имя пользователя. Попробуй ещё раз.",
  "listenbrainz.connected":
    "Привязан как <b>{name}</b> на ListenBrainz. Готов к скробблингу.",
  "listenbrainz.unreachable":
    "ListenBrainz сейчас недоступен. Попробуй позже.",

  /** еженедельный дайджест */
  "digest.header":
    "\u{1F4CA} Твоя неделя в музыке:",
  "digest.scrobble_count":
    "\u{1F3B5} {count} скробблов за неделю",
  "digest.top_artists":
    "\u{1F3C6} Топ исполнителей:",
  "digest.top_tracks":
    "\u{1F3B6} Топ треков:",

  /** дискавери */
  "discovery.caption":
    "\u{1F3B5} Открытие: <b>{artist}</b> \u2014 {track}",

  /** уведомления */
  "shout.notification":
    "\u{1F4E3} Шаут от <b>{author}</b>:",
};

export default ru;
