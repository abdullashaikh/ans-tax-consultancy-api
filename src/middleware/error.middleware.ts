import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { ResponseFormatter } from '../utils/apiResponse';
import { ErrorCode, ErrorCodes } from '../constants/errorCodes';
import { HttpStatusCode, HttpStatus } from '../constants/httpStatus';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.requestId || (req.headers['x-request-id'] as string) || undefined;

  let statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  let errorCode: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected internal error occurred';
  let details: any = undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = HttpStatus.BAD_REQUEST;
    errorCode = ErrorCodes.BAD_REQUEST;
    message = 'Malformed JSON in request body';
  }

  // Log error with correlation ID
  if (statusCode >= 500) {
    logger.error('Unhandled server error:', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      error: err.message,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  } else {
    logger.warn('Client request error:', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      errorCode,
      message,
    });
  }

  ResponseFormatter.error(res, message, errorCode, statusCode, requestId, details);
};
