CREATE TYPE "public"."token_context" AS ENUM('PASSWORD_RESET', 'ACCESS_TOKEN', 'REFRESH_TOKEN');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('backoffice', 'pilot', 'farmer');--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp NOT NULL,
	"context" "token_context" NOT NULL,
	CONSTRAINT "user_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"type" "user_type" DEFAULT 'backoffice' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_token_id_index" ON "user_tokens" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_id_index" ON "users" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_email_index" ON "users" USING btree ("email");