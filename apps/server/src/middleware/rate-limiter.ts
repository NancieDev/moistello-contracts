import type { FastifyInstance, FastifyRequest } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { config } from "../config.js";
import { logger } from "../logger.js";

/** Shared error message shape returned to the client on 429. */
function buildRateLimitReply(
  request: FastifyRequest,
  _context: unknown,
  key: string,
  timeToReset: number
) {
  return {
    ok: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests — please slow down.",
      retryAfterMs: timeToReset,
    },
    request_id: request.id,
  };
}

/**
 * Register the global *default* rate limiter.
 *
 * This limiter applies to every route that does not carry a route-level
 * `config.rateLimit` override. Replay/trace routes register their own
 * tighter limiter via `applyReplayRateLimit`.
 */
export async function registerRateLimiters(app: FastifyInstance): Promise<void> {
  await app.register(fastifyRateLimit, {
    global: true,
    max: config.RATE_LIMIT_DEFAULT_MAX,
    timeWindow: config.RATE_LIMIT_DEFAULT_WINDOW_MS,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
    errorResponseBuilder(request, context) {
      return buildRateLimitReply(request, context, "", context.after);
    },
    onExceeded(request, key) {
      logger.warn(
        { request_id: request.id, route: request.url, key },
        "Rate limit exceeded (default)"
      );
    },
  });
}

/**
 * Per-route options for the replay/trace endpoints.
 *
 * Apply this object as `config: { rateLimit: replayRateLimitConfig }` on any
 * route registration that invokes Soroban simulation or replay.
 */
export const replayRateLimitConfig = {
  max: config.RATE_LIMIT_REPLAY_MAX,
  timeWindow: config.RATE_LIMIT_REPLAY_WINDOW_MS,
  addHeaders: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
    "retry-after": true,
  },
  errorResponseBuilder(request: FastifyRequest, context: { after: number }) {
    logger.warn(
      {
        request_id: request.id,
        route: request.url,
        retryAfterMs: context.after,
      },
      "Rate limit exceeded (replay)"
    );
    return buildRateLimitReply(request, context, "", context.after);
  },
};
