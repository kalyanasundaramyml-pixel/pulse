import { z } from 'zod';

// z.coerce.boolean() calls JS Boolean(value), so the *string* "false" from
// process.env would coerce to true. Parse the literal string instead.
const booleanString = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  COOKIE_SECURE: booleanString,
  MIN_ANONYMOUS_RESPONSES_FOR_BREAKDOWN: z.coerce.number().int().min(1).default(3),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email(),
  ADMIN_BOOTSTRAP_NAME: z.string().default('Administrator'),
  ADMIN_BOOTSTRAP_TEMP_PASSWORD: z.string().min(8),
  CORS_ORIGIN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
