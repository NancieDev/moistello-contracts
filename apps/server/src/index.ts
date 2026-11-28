import Fastify from "fastify";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { registerRateLimiters } from "./middleware/rate-limiter.js";
import { replayRoutes } from "./routes/replay.js";
import {
  GratError,
  ValidationError,
  ErrorCode,
} from "./errors.js";

async function buildServer() {
  const app = Fastify({
    logger: false, // We manage logging ourselves via pino
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // ------------------------------------------------------------------ //
  // Global error handler
  //
  // Maps typed errors to a normalised envelope:
  //   { ok: false, error: { code, message, fields? }, request_id }
  //
  // Stack traces are NEVER included in production responses.
  // ------------------------------------------------------------------ //
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    const isProduction = config.NODE_ENV === "production";

    // ---- Fastify validation error (body/query/params schema failure) ----
    if (error.validation) {
      const fields: Record<string, string[]> = {};
      for (const issue of error.validation) {
        const key = (issue as unknown as { instancePath: string }).instancePath.replace(/^\//, "") || "_root";
        (fields[key] ??= []).push(issue.message ?? "Invalid value");
      }
      logger.warn({ request_id: requestId, fields }, "Request validation failed");
      return reply.code(400).send({
        ok: false,
        error: {
          code: ErrorCode.VALIDATION,
          message: "Request validation failed",
          fields,
        },
        request_id: requestId,
      });
    }

    // ---- First-party typed errors ----
    if (error instanceof ValidationError) {
      logger.warn(
        { request_id: requestId, fields: error.fields },
        error.publicMessage
      );
      return reply.code(error.statusCode).send({
        ok: false,
        error: {
          code: error.code,
          message: error.publicMessage,
          fields: error.fields,
        },
        request_id: requestId,
      });
    }

    if (error instanceof GratError) {
      logger.warn(
        { request_id: requestId, code: error.code, status: error.statusCode },
        error.publicMessage
      );
      return reply.code(error.statusCode).send({
        ok: false,
        error: {
          code: error.code,
          message: error.publicMessage,
        },
        request_id: requestId,
      });
    }

    // ---- @fastify/rate-limit 429 ----
    if (error.statusCode === 429) {
      logger.warn({ request_id: requestId }, "Rate limit exceeded");
      return reply.code(429).send({
        ok: false,
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: "Too many requests — please slow down.",
        },
        request_id: requestId,
      });
    }

    // ---- Unknown / internal errors ----
    logger.error(
      {
        request_id: requestId,
        err: {
          message: error.message,
          name: error.name,
          // Include stack only in non-production logs, never in response
          ...(isProduction ? {} : { stack: error.stack }),
        },
      },
      "Unhandled error"
    );

    return reply.code(500).send({
      ok: false,
      error: {
        code: ErrorCode.INTERNAL,
        // Never leak error.message in production — it may contain internals
        message: isProduction
          ? "An unexpected error occurred. Please try again."
          : error.message,
      },
      request_id: requestId,
    });
  });

  // ------------------------------------------------------------------ //
  // Middleware
  // ------------------------------------------------------------------ //
  await registerRateLimiters(app);

  // ------------------------------------------------------------------ //
  // Routes
  // ------------------------------------------------------------------ //
  await app.register(replayRoutes, { prefix: "/api/v1" });

  app.get("/health", async (_request, reply) => {
    return reply.code(200).send({ ok: true, status: "healthy" });
  });

  return app;
}

async function main() {
  const app = await buildServer();

  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT, env: config.NODE_ENV }, "Server started");
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

main();
