/**
 * Typed error hierarchy for the dripswave API.
 *
 * Every error that escapes a route handler MUST be one of these types.
 * The global error handler in index.ts maps these to normalised HTTP envelopes.
 */

export enum ErrorCode {
  // Validation errors (HTTP 400)
  VALIDATION = "VALIDATION_ERROR",

  // Auth errors (HTTP 401 / 403)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  // Resource errors (HTTP 404)
  NOT_FOUND = "NOT_FOUND",

  // Rate limit (HTTP 429)
  RATE_LIMITED = "RATE_LIMITED",

  // Contract / Soroban errors (HTTP 422)
  CONTRACT_ERROR = "CONTRACT_ERROR",

  // Internal server errors (HTTP 500)
  INTERNAL = "INTERNAL_ERROR",
}

/** Base class for all first-party API errors. */
export class GratError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  /** Safe to include in production responses (no stack traces). */
  public readonly publicMessage: string;

  constructor(opts: {
    code: ErrorCode;
    statusCode: number;
    message: string;
    publicMessage?: string;
  }) {
    super(opts.message);
    this.name = "GratError";
    this.code = opts.code;
    this.statusCode = opts.statusCode;
    this.publicMessage = opts.publicMessage ?? opts.message;
  }
}

export class ValidationError extends GratError {
  public readonly fields: Record<string, string[]>;

  constructor(fields: Record<string, string[]>, message = "Validation failed") {
    super({ code: ErrorCode.VALIDATION, statusCode: 400, message });
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export class UnauthorizedError extends GratError {
  constructor(message = "Authentication required") {
    super({ code: ErrorCode.UNAUTHORIZED, statusCode: 401, message });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends GratError {
  constructor(message = "Insufficient permissions") {
    super({ code: ErrorCode.FORBIDDEN, statusCode: 403, message });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends GratError {
  constructor(resource: string) {
    super({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message: `${resource} not found`,
    });
    this.name = "NotFoundError";
  }
}

export class ContractError extends GratError {
  public readonly contractCode: number;

  constructor(contractCode: number, message: string) {
    super({
      code: ErrorCode.CONTRACT_ERROR,
      statusCode: 422,
      message,
    });
    this.name = "ContractError";
    this.contractCode = contractCode;
  }
}
