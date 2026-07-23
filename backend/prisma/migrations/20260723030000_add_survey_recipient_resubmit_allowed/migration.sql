-- Lets a creator grant one specific recipient a further submission after
-- they've already responded, since free-form editing of a submitted
-- response is no longer allowed.
ALTER TABLE "survey_recipients" ADD COLUMN "resubmit_allowed" BOOLEAN NOT NULL DEFAULT false;
