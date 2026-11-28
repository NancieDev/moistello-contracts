import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { replayRateLimitConfig } from "../middleware/rate-limiter.js";
import { NotFoundError, ContractError } from "../errors.js";

const ReplayBodySchema = z.object({
  contractId: z.string().min(56).max(56),
  functionName: z.string().min(1).max(64),
  args: z.array(z.unknown()).default([]),
  ledger: z.number().int().positive().optional(),
});

/**
 * Register the replay/trace routes.
 *
 * These routes apply the stricter replay rate limiter — each invocation
 * triggers a Soroban simulation which is compute-intensive.
 */
export async function replayRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /replay
   *
   * Simulate a Soroban contract invocation and return the execution trace.
   * Rate-limited to RATE_LIMIT_REPLAY_MAX calls per RATE_LIMIT_REPLAY_WINDOW_MS.
   */
  app.post(
    "/replay",
    {
      config: { rateLimit: replayRateLimitConfig },
      schema: {
        body: {
          type: "object",
          required: ["contractId", "functionName"],
          properties: {
            contractId: { type: "string", minLength: 56, maxLength: 56 },
            functionName: { type: "string", minLength: 1, maxLength: 64 },
            args: { type: "array" },
            ledger: { type: "integer", minimum: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  traceId: { type: "string" },
                  nodes: { type: "array" },
                  ledger: { type: "integer" },
                  durationMs: { type: "number" },
                },
              },
              request_id: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = ReplayBodySchema.safeParse(request.body);
      if (!body.success) {
        throw new (await import("../errors.js")).ValidationError(
          Object.fromEntries(
            body.error.issues.map((i) => [i.path.join("."), [i.message]])
          )
        );
      }

      const { contractId, functionName, args, ledger } = body.data;

      // Placeholder: in production this calls the Soroban RPC simulation endpoint.
      // Throws ContractError or NotFoundError as appropriate.
      const start = Date.now();

      return reply.code(200).send({
        ok: true,
        data: {
          traceId: `${contractId.slice(0, 8)}-${Date.now()}`,
          nodes: [],
          ledger: ledger ?? 0,
          durationMs: Date.now() - start,
        },
        request_id: request.id,
      });
    }
  );

  /**
   * GET /replay/:traceId
   *
   * Retrieve a previously computed execution trace by ID.
   * Uses the replay rate limiter since it may re-fetch from the RPC layer.
   */
  app.get(
    "/replay/:traceId",
    {
      config: { rateLimit: replayRateLimitConfig },
      schema: {
        params: {
          type: "object",
          properties: { traceId: { type: "string" } },
          required: ["traceId"],
        },
      },
    },
    async (request, reply) => {
      const { traceId } = request.params as { traceId: string };

      // Placeholder: look up cached trace
      if (!traceId || traceId.length < 8) {
        throw new NotFoundError("trace");
      }

      return reply.code(200).send({
        ok: true,
        data: { traceId, nodes: [] },
        request_id: request.id,
      });
    }
  );
}
