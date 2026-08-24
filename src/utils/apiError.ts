import { ErrorCode, ErrorCodes } from '../constants/errorCodes';
import { HttpStatusCode, HttpStatus } from '../constants/httpStatus';

export class ApiError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any> | Array<any>;

  constructor(
    statusCode: HttpStatusCode,
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
    details?: Record<string, any> | Array<any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code: ErrorCode = ErrorCodes.BAD_REQUEST, details?: any): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, message, code, details);
  }

  static unauthorized(message: string = 'Authentication required', code: ErrorCode = ErrorCodes.AUTH_UNAUTHORIZED): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, message, code);
  }

  static forbidden(message: string = 'Access denied: insufficient permissions', code: ErrorCode = ErrorCodes.AUTH_FORBIDDEN): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, message, code);
  }

  static notFound(message: string = 'Requested resource not found', code: ErrorCode = ErrorCodes.RESOURCE_NOT_FOUND): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, message, code);
  }

  static conflict(message: string, code: ErrorCode = ErrorCodes.CONFLICT): ApiError {
    return new ApiError(HttpStatus.CONFLICT, message, code);
  }

  static unprocessable(message: string, details?: any): ApiError {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, message, ErrorCodes.VALIDATION_ERROR, details);
  }

  static tooManyRequests(message: string = 'Rate limit exceeded, please try again later'): ApiError {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, message, ErrorCodes.RATE_LIMIT_EXCEEDED);
  }

  static internal(message: string = 'An unexpected internal server error occurred'): ApiError {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message, ErrorCodes.INTERNAL_SERVER_ERROR, undefined, false);
  }
}
