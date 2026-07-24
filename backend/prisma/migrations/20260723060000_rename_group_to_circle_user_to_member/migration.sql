-- Rename the "Group" concept to "Circle" and the "User" concept to "Member"
-- throughout the schema. Pure renames — no data is transformed, and every
-- row's identity/relationships are preserved exactly.

-- ===== User -> Member =====
ALTER TABLE "users" RENAME TO "members";
ALTER TABLE "user_import_batches" RENAME TO "member_import_batches";
ALTER TABLE "user_import_row_errors" RENAME TO "member_import_row_errors";

ALTER TABLE "survey_recipients" RENAME COLUMN "user_id" TO "member_id";
ALTER TABLE "survey_response_access" RENAME COLUMN "user_id" TO "member_id";
ALTER TABLE "attributed_responses" RENAME COLUMN "respondent_user_id" TO "respondent_member_id";
ALTER TABLE "one_on_one_recipients" RENAME COLUMN "user_id" TO "member_id";
ALTER TABLE "one_on_one_runs" RENAME COLUMN "respondent_user_id" TO "respondent_member_id";

ALTER TYPE "UserRole" RENAME TO "MemberRole";
ALTER TYPE "MemberRole" RENAME VALUE 'USER' TO 'MEMBER';

-- ===== Group -> Circle =====
ALTER TABLE "groups" RENAME TO "circles";
ALTER TABLE "group_members" RENAME TO "circle_members";
ALTER TABLE "circle_members" RENAME COLUMN "group_id" TO "circle_id";
ALTER TABLE "circle_members" RENAME COLUMN "user_id" TO "member_id";
