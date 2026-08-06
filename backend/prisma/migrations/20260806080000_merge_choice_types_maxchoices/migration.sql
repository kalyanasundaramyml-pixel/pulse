-- Merge SINGLE_CHOICE into MULTI_CHOICE with an explicit max_choices field.
-- SINGLE_CHOICE stays defined in the QuestionType enum (Postgres can't
-- cheaply drop an enum label without a full type-recreation dance), but
-- after this migration no row anywhere uses it — going forward the builder
-- only ever writes MULTI_CHOICE, and single-vs-multi behavior is driven by
-- comparing selection count against max_choices instead of the type string.

-- AlterTable
ALTER TABLE "questions" ADD COLUMN "max_choices" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "one_on_one_questions" ADD COLUMN "max_choices" INTEGER NOT NULL DEFAULT 1;

-- Existing MULTI_CHOICE questions: their practical ceiling was always
-- "select every option" — make that the explicit max_choices, preserving
-- "pick as many as you like" exactly. Must run BEFORE the SINGLE_CHOICE ->
-- MULTI_CHOICE flip below, since the WHERE clause keys off the *current*
-- question_type and former-SINGLE_CHOICE rows must not be swept into this
-- option-count backfill (they get max_choices = 1 instead, already set by
-- the column default above).
UPDATE "questions" q
SET "max_choices" = sub.option_count
FROM (
  SELECT "question_id", COUNT(*) AS option_count
  FROM "question_options"
  GROUP BY "question_id"
) sub
WHERE q."id" = sub."question_id" AND q."question_type" = 'MULTI_CHOICE';

UPDATE "one_on_one_questions" q
SET "max_choices" = sub.option_count
FROM (
  SELECT "question_id", COUNT(*) AS option_count
  FROM "one_on_one_question_options"
  GROUP BY "question_id"
) sub
WHERE q."id" = sub."question_id" AND q."question_type" = 'MULTI_CHOICE';

-- Normalize: every existing SINGLE_CHOICE question becomes MULTI_CHOICE with
-- max_choices = 1 (identical respondent behavior — exactly one selectable
-- option; max_choices is already 1 via the column default set above).
UPDATE "questions" SET "question_type" = 'MULTI_CHOICE' WHERE "question_type" = 'SINGLE_CHOICE';
UPDATE "one_on_one_questions" SET "question_type" = 'MULTI_CHOICE' WHERE "question_type" = 'SINGLE_CHOICE';
