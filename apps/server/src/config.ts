import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // Default rate-limit window (applies to all routes not explicitly overridden)
  RATE_LIMIT_DEFAULT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_DEFAULT_MAX: z.coerce.number().int().positive().default(120),

  // Replay/trace rate-limit window (more aggressive throttle)
  RATE_LIMIT_REPLAY_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_REPLAY_MAX: z.coerce.number().int().positive().default(10),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid server configuration:\n${result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`
    );
  }
  return result.data;
}

export const config = loadConfig();
