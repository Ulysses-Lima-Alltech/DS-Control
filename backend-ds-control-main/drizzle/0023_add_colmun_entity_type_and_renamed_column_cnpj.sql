CREATE TYPE "public"."type" AS ENUM('PF', 'PJ');--> statement-breakpoint
ALTER TABLE "customers" RENAME COLUMN "cnpj" TO "document_number";--> statement-breakpoint
DROP INDEX "customer_cnpj_index";--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "razao_social" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "type" "type" DEFAULT 'PJ' NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_document_number_index" ON "customers" USING btree ("document_number");