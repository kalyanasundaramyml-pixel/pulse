-- De-duplicate any existing (created_by, title) collisions before enforcing
-- uniqueness — drafts created before this constraint existed (e.g. multiple
-- "Untitled survey") may already collide, so give every collision after the
-- first (oldest) row a distinguishing suffix.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, title,
           ROW_NUMBER() OVER (PARTITION BY created_by, title ORDER BY created_at) AS rn
    FROM surveys
  LOOP
    IF rec.rn > 1 THEN
      UPDATE surveys SET title = rec.title || ' (' || rec.rn || ')' WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_title_key" UNIQUE ("created_by", "title");

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, title,
           ROW_NUMBER() OVER (PARTITION BY created_by, title ORDER BY created_at) AS rn
    FROM one_on_one_templates
  LOOP
    IF rec.rn > 1 THEN
      UPDATE one_on_one_templates SET title = rec.title || ' (' || rec.rn || ')' WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "one_on_one_templates" ADD CONSTRAINT "one_on_one_templates_created_by_title_key" UNIQUE ("created_by", "title");
