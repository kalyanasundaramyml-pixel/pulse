-- AlterTable
ALTER TABLE "surveys" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "surveys" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "one_on_one_templates" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;
