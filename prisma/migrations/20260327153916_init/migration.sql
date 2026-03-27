-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FREE', 'PREMIUM', 'ADMIN');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_NEWSLETTER', 'SYSTEM', 'COMMENT_REPLY');

-- CreateEnum
CREATE TYPE "NotificationPreference" AS ENUM ('INSTANT', 'DAILY_DIGEST', 'OFF');

-- CreateEnum
CREATE TYPE "AIProviderType" AS ENUM ('OLLAMA', 'OPENAI', 'ANTHROPIC', 'GROQ', 'GEMINI', 'MISTRAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "email_verified" TIMESTAMP(3),
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'FREE',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "newsletter_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "website_url" TEXT,
    "logo_url" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletters" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "raw_html" TEXT NOT NULL,
    "raw_text" TEXT,
    "processed_content" TEXT,
    "summary" TEXT,
    "highlights" JSONB,
    "published_at" TIMESTAMP(3),
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_tags" (
    "newsletter_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "user_interests" (
    "user_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "notification_pref" "NotificationPreference" NOT NULL DEFAULT 'INSTANT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "read_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "read_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "newsletter_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_import_logs" (
    "id" TEXT NOT NULL,
    "mailgun_message_id" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "subject" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "newsletter_id" TEXT,

    CONSTRAINT "email_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL,
    "provider" "AIProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT,
    "api_endpoint" TEXT,
    "model" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_fallback" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_processing_logs" (
    "id" TEXT NOT NULL,
    "newsletter_id" TEXT NOT NULL,
    "provider" "AIProviderType" NOT NULL,
    "model" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "cost_estimate" DOUBLE PRECISION,
    "duration_ms" INTEGER,
    "status" "ProcessingStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_sources_sender_email_key" ON "newsletter_sources"("sender_email");

-- CreateIndex
CREATE INDEX "newsletters_source_id_idx" ON "newsletters"("source_id");

-- CreateIndex
CREATE INDEX "newsletters_is_processed_idx" ON "newsletters"("is_processed");

-- CreateIndex
CREATE INDEX "newsletters_published_at_idx" ON "newsletters"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_tags_newsletter_id_tag_id_key" ON "newsletter_tags"("newsletter_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_interests_user_id_tag_id_key" ON "user_interests"("user_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_source_id_key" ON "subscriptions"("user_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorites_user_id_source_id_key" ON "user_favorites"("user_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "read_history_user_id_newsletter_id_key" ON "read_history"("user_id", "newsletter_id");

-- CreateIndex
CREATE INDEX "comments_newsletter_id_idx" ON "comments"("newsletter_id");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "ratings_newsletter_id_idx" ON "ratings"("newsletter_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_user_id_newsletter_id_key" ON "ratings"("user_id", "newsletter_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "email_import_logs_mailgun_message_id_key" ON "email_import_logs"("mailgun_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_import_logs_newsletter_id_key" ON "email_import_logs"("newsletter_id");

-- CreateIndex
CREATE INDEX "email_import_logs_status_idx" ON "email_import_logs"("status");

-- CreateIndex
CREATE INDEX "ai_processing_logs_newsletter_id_idx" ON "ai_processing_logs"("newsletter_id");

-- CreateIndex
CREATE INDEX "ai_processing_logs_status_idx" ON "ai_processing_logs"("status");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "newsletter_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_tags" ADD CONSTRAINT "newsletter_tags_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_tags" ADD CONSTRAINT "newsletter_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "newsletter_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "newsletter_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "read_history" ADD CONSTRAINT "read_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "read_history" ADD CONSTRAINT "read_history_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_import_logs" ADD CONSTRAINT "email_import_logs_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_processing_logs" ADD CONSTRAINT "ai_processing_logs_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
