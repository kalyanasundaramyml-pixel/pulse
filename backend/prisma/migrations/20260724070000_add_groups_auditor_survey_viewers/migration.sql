-- Org Groups: every member belongs to exactly one Group (scalar FK, not a
-- join table). Seed a "common" default group and backfill every existing
-- member onto it before making the column required.

-- CreateTable
-- Note: the PK/index names below are prefixed "org_groups_", not "groups_" —
-- the earlier Group->Circle rename (20260723060000) renamed the "groups"
-- table to "circles" but Postgres does not rename its associated constraint
-- names, so "groups_pkey" is still in use by that (now "circles") table.
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_groups_name_key" ON "groups"("name");

-- Seed the default group with a fixed literal id — this row has to exist as
-- plain SQL, before any Prisma code runs, so the backfill below has a value
-- to point every existing member at.
INSERT INTO "groups" ("id", "name", "is_default", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'common', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "members" ADD COLUMN "group_id" TEXT;
UPDATE "members" SET "group_id" = '00000000-0000-0000-0000-000000000001' WHERE "group_id" IS NULL;
ALTER TABLE "members" ALTER COLUMN "group_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "members_group_id_idx" ON "members"("group_id");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New role: Auditor. One level above Creator, read-only oversight of every
-- survey/1:1 created within their own group.
ALTER TYPE "MemberRole" ADD VALUE 'AUDITOR' AFTER 'CREATOR';

-- Survey Viewer grants: a narrow, per-member exception to view one survey's
-- dashboard/results regardless of group. Surveys only, no equivalent for
-- one-on-ones.
CREATE TABLE "survey_viewers" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_viewers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "survey_viewers_survey_id_member_id_key" ON "survey_viewers"("survey_id", "member_id");

-- AddForeignKey
ALTER TABLE "survey_viewers" ADD CONSTRAINT "survey_viewers_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_viewers" ADD CONSTRAINT "survey_viewers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_viewers" ADD CONSTRAINT "survey_viewers_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
