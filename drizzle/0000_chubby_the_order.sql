CREATE TABLE "scrobble_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"artist" text NOT NULL,
	"track" text NOT NULL,
	"album" text,
	"scrobbled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_discoveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"track_key" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	CONSTRAINT "sent_discoveries_user_id_track_key_unique" UNIQUE("user_id","track_key")
);
--> statement-breakpoint
CREATE TABLE "service_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"service_type" varchar(20) NOT NULL,
	"auth_token" text NOT NULL,
	"service_username" varchar(100),
	CONSTRAINT "service_connections_user_id_service_type_unique" UNIQUE("user_id","service_type")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"language" varchar(10) DEFAULT 'en',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "scrobble_cache" ADD CONSTRAINT "scrobble_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_discoveries" ADD CONSTRAINT "sent_discoveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_connections" ADD CONSTRAINT "service_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;