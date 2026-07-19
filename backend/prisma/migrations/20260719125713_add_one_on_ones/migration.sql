-- CreateEnum
CREATE TYPE "OneOnOneRunStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "one_on_one_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_on_one_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_questions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "rating_scale_min" INTEGER,
    "rating_scale_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_on_one_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "one_on_one_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_recipients" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_on_one_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_runs" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "respondent_user_id" TEXT NOT NULL,
    "initiated_by" TEXT NOT NULL,
    "status" "OneOnOneRunStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "one_on_one_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_answers" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "rating_value" INTEGER,
    "text_value" TEXT,
    "comment_text" TEXT,

    CONSTRAINT "one_on_one_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_answer_options" (
    "id" TEXT NOT NULL,
    "answer_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,

    CONSTRAINT "one_on_one_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "one_on_one_questions_template_id_position_key" ON "one_on_one_questions"("template_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "one_on_one_question_options_question_id_position_key" ON "one_on_one_question_options"("question_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "one_on_one_recipients_template_id_user_id_key" ON "one_on_one_recipients"("template_id", "user_id");

-- CreateIndex
CREATE INDEX "one_on_one_runs_template_id_respondent_user_id_idx" ON "one_on_one_runs"("template_id", "respondent_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "one_on_one_answers_run_id_question_id_key" ON "one_on_one_answers"("run_id", "question_id");

-- CreateIndex
CREATE INDEX "one_on_one_answers_question_id_idx" ON "one_on_one_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "one_on_one_answer_options_answer_id_option_id_key" ON "one_on_one_answer_options"("answer_id", "option_id");

-- AddForeignKey
ALTER TABLE "one_on_one_templates" ADD CONSTRAINT "one_on_one_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_questions" ADD CONSTRAINT "one_on_one_questions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "one_on_one_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_question_options" ADD CONSTRAINT "one_on_one_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "one_on_one_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_recipients" ADD CONSTRAINT "one_on_one_recipients_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "one_on_one_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_recipients" ADD CONSTRAINT "one_on_one_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_runs" ADD CONSTRAINT "one_on_one_runs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "one_on_one_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_runs" ADD CONSTRAINT "one_on_one_runs_respondent_user_id_fkey" FOREIGN KEY ("respondent_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_runs" ADD CONSTRAINT "one_on_one_runs_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_answers" ADD CONSTRAINT "one_on_one_answers_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "one_on_one_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_answers" ADD CONSTRAINT "one_on_one_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "one_on_one_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_answer_options" ADD CONSTRAINT "one_on_one_answer_options_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "one_on_one_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_answer_options" ADD CONSTRAINT "one_on_one_answer_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "one_on_one_question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
