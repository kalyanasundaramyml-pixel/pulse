-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LEADER', 'USER');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('RATING', 'TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_anonymous" BOOLEAN NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "rating_scale_min" INTEGER,
    "rating_scale_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_recipients" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_responses" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anonymous_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_answers" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "rating_value" INTEGER,
    "text_value" TEXT,

    CONSTRAINT "anonymous_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_answer_options" (
    "id" TEXT NOT NULL,
    "answer_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,

    CONSTRAINT "anonymous_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_response_access" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_response_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributed_responses" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "respondent_user_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attributed_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributed_answers" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "rating_value" INTEGER,
    "text_value" TEXT,

    CONSTRAINT "attributed_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributed_answer_options" (
    "id" TEXT NOT NULL,
    "answer_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,

    CONSTRAINT "attributed_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_import_batches" (
    "id" TEXT NOT NULL,
    "imported_by" TEXT NOT NULL,
    "filename" TEXT,
    "total_rows" INTEGER NOT NULL,
    "success_count" INTEGER NOT NULL,
    "error_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_import_row_errors" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_row" JSONB NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "user_import_row_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "surveys_created_by_idx" ON "surveys"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "questions_survey_id_position_key" ON "questions"("survey_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_position_key" ON "question_options"("question_id", "position");

-- CreateIndex
CREATE INDEX "survey_recipients_user_id_idx" ON "survey_recipients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_recipients_survey_id_user_id_key" ON "survey_recipients"("survey_id", "user_id");

-- CreateIndex
CREATE INDEX "anonymous_responses_survey_id_idx" ON "anonymous_responses"("survey_id");

-- CreateIndex
CREATE INDEX "anonymous_answers_question_id_idx" ON "anonymous_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_answers_response_id_question_id_key" ON "anonymous_answers"("response_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_answer_options_answer_id_option_id_key" ON "anonymous_answer_options"("answer_id", "option_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_response_access_response_id_key" ON "survey_response_access"("response_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_response_access_survey_id_user_id_key" ON "survey_response_access"("survey_id", "user_id");

-- CreateIndex
CREATE INDEX "attributed_responses_survey_id_idx" ON "attributed_responses"("survey_id");

-- CreateIndex
CREATE UNIQUE INDEX "attributed_responses_survey_id_respondent_user_id_key" ON "attributed_responses"("survey_id", "respondent_user_id");

-- CreateIndex
CREATE INDEX "attributed_answers_question_id_idx" ON "attributed_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attributed_answers_response_id_question_id_key" ON "attributed_answers"("response_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attributed_answer_options_answer_id_option_id_key" ON "attributed_answer_options"("answer_id", "option_id");

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_recipients" ADD CONSTRAINT "survey_recipients_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_recipients" ADD CONSTRAINT "survey_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_responses" ADD CONSTRAINT "anonymous_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_answers" ADD CONSTRAINT "anonymous_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "anonymous_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_answers" ADD CONSTRAINT "anonymous_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_answer_options" ADD CONSTRAINT "anonymous_answer_options_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "anonymous_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_answer_options" ADD CONSTRAINT "anonymous_answer_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_response_access" ADD CONSTRAINT "survey_response_access_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_response_access" ADD CONSTRAINT "survey_response_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_response_access" ADD CONSTRAINT "survey_response_access_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "anonymous_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributed_responses" ADD CONSTRAINT "attributed_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributed_responses" ADD CONSTRAINT "attributed_responses_respondent_user_id_fkey" FOREIGN KEY ("respondent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributed_answers" ADD CONSTRAINT "attributed_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "attributed_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributed_answers" ADD CONSTRAINT "attributed_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributed_answer_options" ADD CONSTRAINT "attributed_answer_options_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "attributed_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributed_answer_options" ADD CONSTRAINT "attributed_answer_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_import_batches" ADD CONSTRAINT "user_import_batches_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_import_row_errors" ADD CONSTRAINT "user_import_row_errors_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "user_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
