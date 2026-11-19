BEGIN;

CREATE TABLE "DiscardedUpload" (
    "path" TEXT NOT NULL,
    CONSTRAINT "DiscardedUpload_pkey" PRIMARY KEY ("path")
);

ALTER TABLE "DiscardedUpload" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DiscardedUpload" FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "DiscardedUpload" FROM anon;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "DiscardedUpload" FROM authenticated;
    END IF;
END;
$$;

COMMIT;
