import { PaginationMeta } from '../types/api';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class PaginationUtil {
  static parseQuery(query: Record<string, any>): {
    page: number;
    limit: number;
    offset: number;
    search?: string;
    sortBy?: string;
    sortOrder: 'ASC' | 'DESC';
  } {
    const rawPage = parseInt(query['page'], 10);
    const rawLimit = parseInt(query['limit'], 10);

    const page = isNaN(rawPage) || rawPage < 1 ? DEFAULT_PAGE : rawPage;
    let limit = isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit;

    // Enforce maximum page size limit
    if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }

    const offset = (page - 1) * limit;
    const search = typeof query['search'] === 'string' ? query['search'].trim() : undefined;
    const sortBy = typeof query['sortBy'] === 'string' ? query['sortBy'].trim() : undefined;
    const sortOrder = query['sortOrder']?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    return { page, limit, offset, search, sortBy, sortOrder };
  }

  static buildMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
