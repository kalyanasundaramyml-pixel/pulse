-- Enums
CREATE TYPE "BlockType" AS ENUM ('WELCOME', 'QUESTIONS', 'END');
CREATE TYPE "OneOnOneStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- OneOnOneTemplate gains isTemplate (existing rows stay templates) + status
ALTER TABLE "one_on_one_templates" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "one_on_one_templates" ADD COLUMN "status" "OneOnOneStatus" NOT NULL DEFAULT 'DRAFT';

-- SurveyBlock
CREATE TABLE "survey_blocks" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "block_type" "BlockType" NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "survey_blocks_survey_id_position_key" ON "survey_blocks"("survey_id", "position");

ALTER TABLE "survey_blocks" ADD CONSTRAINT "survey_blocks_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OneOnOneBlock
CREATE TABLE "one_on_one_blocks" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "block_type" "BlockType" NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_on_one_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "one_on_one_blocks_template_id_position_key" ON "one_on_one_blocks"("template_id", "position");

ALTER TABLE "one_on_one_blocks" ADD CONSTRAINT "one_on_one_blocks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "one_on_one_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- questions/one_on_one_questions gain a nullable block_id for now; backfilled below
ALTER TABLE "questions" ADD COLUMN "block_id" TEXT;
ALTER TABLE "one_on_one_questions" ADD COLUMN "block_id" TEXT;

-- Backfill: every existing survey gets Welcome/Block 1/End; existing questions
-- move into "Block 1". Positions are already unique per survey, and since every
-- question for a survey moves into the same block, (block_id, position) stays
-- unique automatically.
DO $$
DECLARE
  s RECORD;
  welcome_id TEXT;
  block1_id TEXT;
  end_id TEXT;
BEGIN
  FOR s IN SELECT "id" FROM "surveys" LOOP
    welcome_id := gen_random_uuid();
    block1_id := gen_random_uuid();
    end_id := gen_random_uuid();

    INSERT INTO "survey_blocks" ("id", "survey_id", "position", "block_type", "title", "updated_at")
    VALUES (welcome_id, s."id", 0, 'WELCOME', 'Welcome', CURRENT_TIMESTAMP);

    INSERT INTO "survey_blocks" ("id", "survey_id", "position", "block_type", "name", "updated_at")
    VALUES (block1_id, s."id", 1, 'QUESTIONS', 'Block 1', CURRENT_TIMESTAMP);

    INSERT INTO "survey_blocks" ("id", "survey_id", "position", "block_type", "title", "updated_at")
    VALUES (end_id, s."id", 2, 'END', 'Thank you', CURRENT_TIMESTAMP);

    UPDATE "questions" SET "block_id" = block1_id WHERE "survey_id" = s."id";
  END LOOP;
END $$;

DO $$
DECLARE
  t RECORD;
  welcome_id TEXT;
  block1_id TEXT;
  end_id TEXT;
BEGIN
  FOR t IN SELECT "id" FROM "one_on_one_templates" LOOP
    welcome_id := gen_random_uuid();
    block1_id := gen_random_uuid();
    end_id := gen_random_uuid();

    INSERT INTO "one_on_one_blocks" ("id", "template_id", "position", "block_type", "title", "updated_at")
    VALUES (welcome_id, t."id", 0, 'WELCOME', 'Welcome', CURRENT_TIMESTAMP);

    INSERT INTO "one_on_one_blocks" ("id", "template_id", "position", "block_type", "name", "updated_at")
    VALUES (block1_id, t."id", 1, 'QUESTIONS', 'Block 1', CURRENT_TIMESTAMP);

    INSERT INTO "one_on_one_blocks" ("id", "template_id", "position", "block_type", "title", "updated_at")
    VALUES (end_id, t."id", 2, 'END', 'Thank you', CURRENT_TIMESTAMP);

    UPDATE "one_on_one_questions" SET "block_id" = block1_id WHERE "template_id" = t."id";
  END LOOP;
END $$;

-- Enforce NOT NULL + move uniqueness/position scoping from survey/template to block
ALTER TABLE "questions" ALTER COLUMN "block_id" SET NOT NULL;
DROP INDEX "questions_survey_id_position_key";
CREATE UNIQUE INDEX "questions_block_id_position_key" ON "questions"("block_id", "position");
ALTER TABLE "questions" ADD CONSTRAINT "questions_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "survey_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "one_on_one_questions" ALTER COLUMN "block_id" SET NOT NULL;
DROP INDEX "one_on_one_questions_template_id_position_key";
CREATE UNIQUE INDEX "one_on_one_questions_block_id_position_key" ON "one_on_one_questions"("block_id", "position");
ALTER TABLE "one_on_one_questions" ADD CONSTRAINT "one_on_one_questions_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "one_on_one_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
