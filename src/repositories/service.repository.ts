import { pool, RowDataPacket } from '../config/database';
import { ServiceRecord, ServiceCategoryRecord } from '../types/models';

export class ServiceRepository {
  static async listCategories(activeOnly: boolean = true): Promise<ServiceCategoryRecord[]> {
    const query = activeOnly
      ? `SELECT id, name, slug, description, icon, display_order, is_active, created_at, updated_at
         FROM service_categories WHERE is_active = 1 ORDER BY display_order ASC, name ASC`
      : `SELECT id, name, slug, description, icon, display_order, is_active, created_at, updated_at
         FROM service_categories ORDER BY display_order ASC, name ASC`;
    const [rows] = await pool.query<RowDataPacket[]>(query);
    return rows as ServiceCategoryRecord[];
  }

  static async findCategoryBySlug(slug: string): Promise<ServiceCategoryRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, slug, description, icon, display_order, is_active, created_at, updated_at
       FROM service_categories WHERE slug = ? LIMIT 1`,
      [slug]
    );
    return (rows[0] as ServiceCategoryRecord) || null;
  }

  static async listServices(params: {
    categoryId?: number;
    activeOnly?: boolean;
  }): Promise<(ServiceRecord & { category_name: string; category_slug: string })[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.activeOnly !== false) {
      conditions.push('s.is_active = 1');
    }
    if (params.categoryId) {
      conditions.push('s.category_id = ?');
      values.push(params.categoryId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.category_id, s.name, s.slug, s.short_description, s.description,
              s.eligibility, s.documents_required_description, s.processing_time,
              s.base_price, s.currency, s.is_active, s.display_order, s.created_at, s.updated_at,
              sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       INNER JOIN service_categories sc ON sc.id = s.category_id
       ${whereClause}
       ORDER BY s.display_order ASC, s.name ASC`,
      values
    );
    return rows as (ServiceRecord & { category_name: string; category_slug: string })[];
  }

  static async findServiceBySlug(slug: string): Promise<(ServiceRecord & { category_name: string; category_slug: string }) | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.category_id, s.name, s.slug, s.short_description, s.description,
              s.eligibility, s.documents_required_description, s.processing_time,
              s.base_price, s.currency, s.is_active, s.display_order, s.created_at, s.updated_at,
              sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       INNER JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.slug = ?
       LIMIT 1`,
      [slug]
    );
    return (rows[0] as (ServiceRecord & { category_name: string; category_slug: string })) || null;
  }

  static async findServiceById(id: number): Promise<ServiceRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, category_id, name, slug, short_description, description, eligibility,
              documents_required_description, processing_time, base_price, currency,
              is_active, display_order, created_at, updated_at
       FROM services WHERE id = ? LIMIT 1`,
      [id]
    );
    return (rows[0] as ServiceRecord) || null;
  }
}
