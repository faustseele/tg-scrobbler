import {
  bigint,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** telegram user IDs can exceed 32-bit integer range */
  telegramId: bigint("telegram_id", { mode: "bigint" }).unique().notNull(),
  language: varchar("language", { length: 10 }).default("en"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceConnections = pgTable(
  "service_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    /** one of: 'lastfm', 'librefm', 'listenbrainz' */
    serviceType: varchar("service_type", { length: 20 }).notNull(),
    authToken: text("auth_token").notNull(),
    serviceUsername: varchar("service_username", { length: 100 }),
  },
  (table) => [unique().on(table.userId, table.serviceType)],
);

export const scrobbleCache = pgTable("scrobble_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  artist: text("artist").notNull(),
  track: text("track").notNull(),
  album: text("album"),
  scrobbledAt: timestamp("scrobbled_at").defaultNow().notNull(),
});

export const sentDiscoveries = pgTable(
  "sent_discoveries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    /** composite key string: artist + track */
    trackKey: text("track_key").notNull(),
    sentAt: timestamp("sent_at").defaultNow(),
  },
  (table) => [unique().on(table.userId, table.trackKey)],
);

/** short-lived queue of scrobbles awaiting the user's button click
 *  (bot-sent recommendations and roulette picks).
 *  a row is inserted when the bot sends an audio with a scrobble button,
 *  and removed once the user clicks it */
export const pendingScrobbles = pgTable("pending_scrobbles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  artist: text("artist").notNull(),
  track: text("track").notNull(),
  album: text("album"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
