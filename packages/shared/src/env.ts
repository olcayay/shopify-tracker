/**
 * Environment variable validation utility.
 *
 * Call `validateEnv()` at process startup to fail fast when
 * required variables are missing.
 */

export interface EnvValidationError {
  missing: string[];
  message: string;
}

/**
 * Validates that all required environment variables are present.
 * Throws with a descriptive error listing ALL missing vars (not just the first).
 *
 * @param required - Array of environment variable names that must be set
 * @param env - Environment object to check (defaults to process.env)
 */
export function validateEnv(
  required: string[],
  env: Record<string, string | undefined> = process.env,
): void {
  const missing = required.filter(
    (name) => env[name] === undefined || env[name] === "",
  );

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}`;
    const error = new Error(message);
    (error as any).missing = missing;
    throw error;
  }
}

/** Required env vars for the API package */
export const API_REQUIRED_ENV = [
  "DATABASE_URL",
  "JWT_SECRET",
] as const;

/** Required env vars for the scraper/worker package */
export const SCRAPER_REQUIRED_ENV = [
  "DATABASE_URL",
] as const;
