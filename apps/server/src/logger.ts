import pino from "pino";
import { config } from "./config.js";

/**
 * Structured logger instance.
 *
 * In production, outputs newline-delimited JSON.
 * In development, outputs human-readable coloured output via pino-pretty.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
  redact: {
    // Never log secrets, tokens, or auth headers.
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.secret",
      "req.body.privateKey",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        request_id: req.id,
        user_agent: req.headers["user-agent"],
      };
    },
    res(res) {
      return {
        status_code: res.statusCode,
      };
    },
  },
});
