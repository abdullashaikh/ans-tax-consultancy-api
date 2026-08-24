import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types/api';
import { HttpStatusCode, HttpStatus } from '../constants/httpStatus';
import { ErrorCode } from '../constants/errorCodes';

export class ResponseFormatter {
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: HttpStatusCode = HttpStatus.OK,
    meta?: PaginationMeta
  ): Response<ApiResponse<T>> {
    const payload: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta,
    };
    return res.status(statusCode).json(payload);
  }

  static created<T>(res: Response, data?: T, message: string = 'Resource created successfully'): Response<ApiResponse<T>> {
    return ResponseFormatter.success(res, data, message, HttpStatus.CREATED);
  }

  static noContent(res: Response): Response {
    return res.status(HttpStatus.NO_CONTENT).send();
  }

  static error(
    res: Response,
    message: string,
    code: ErrorCode,
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    requestId?: string,
    details?: any
  ): Response<ApiResponse> {
    const payload: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        requestId,
        details,
      },
    };
    return res.status(statusCode).json(payload);
  }
}
