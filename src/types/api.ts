import { ErrorCode } from '../constants/errorCodes';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiErrorPayload;
  meta?: PaginationMeta;
}

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  requestId?: string;
  details?: Record<string, any> | Array<any>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}
