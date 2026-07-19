// tests/helpers.ts wipes every row in the target database between test cases.
// Defaulting to a distinctly-named database (not the dev/Compose "feedback" DB)
// means running `npm test` without config can't silently nuke real data.
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '4001';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://feedback:feedback@localhost:5432/feedback_test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-please-ignore';
process.env.COOKIE_SECURE = 'false';
process.env.MIN_ANONYMOUS_RESPONSES_FOR_BREAKDOWN = process.env.MIN_ANONYMOUS_RESPONSES_FOR_BREAKDOWN ?? '3';
process.env.ADMIN_BOOTSTRAP_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@example.com';
process.env.ADMIN_BOOTSTRAP_NAME = process.env.ADMIN_BOOTSTRAP_NAME ?? 'Administrator';
process.env.ADMIN_BOOTSTRAP_TEMP_PASSWORD = process.env.ADMIN_BOOTSTRAP_TEMP_PASSWORD ?? 'change-me-on-first-login';
