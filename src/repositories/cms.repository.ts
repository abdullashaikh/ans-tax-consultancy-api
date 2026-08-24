import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { BlogPostStatus } from '../types/models';

export class CmsRepository {
  // ── FAQs ──
  static async listFaqs(serviceId?: number, activeOnly: boolean = true): Promise<RowDataPacket[]> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (activeOnly) {
      conditions.push('f.is_active = 1');
    }
    if (serviceId) {
      conditions.push('f.service_id = ?');
      values.push(serviceId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, f.service_id, f.question, f.answer, f.display_order, f.is_active, f.created_at,
              s.name AS service_name
       FROM faqs f
       LEFT JOIN services s ON s.id = f.service_id
       ${whereClause}
       ORDER BY f.display_order ASC, f.created_at ASC`,
      values
    );
    return rows;
  }

  static async createFaq(params: {
    serviceId?: number | null;
    question: string;
    answer: string;
    displayOrder?: number;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO faqs (service_id, question, answer, display_order, is_active) VALUES (?, ?, ?, ?, 1)`,
      [params.serviceId || null, params.question, params.answer, params.displayOrder || 0]
    );
    return result.insertId;
  }

  // ── Blog Posts ──
  static async listBlogPosts(params: {
    categoryId?: number;
    status?: BlogPostStatus;
    limit: number;
    offset: number;
  }): Promise<{ posts: any[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.categoryId) {
      conditions.push('bp.category_id = ?');
      values.push(params.categoryId);
    }
    if (params.status) {
      conditions.push('bp.status = ?');
      values.push(params.status);
    } else {
      conditions.push("bp.status = 'PUBLISHED'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM blog_posts bp ${whereClause}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image, bp.status,
              bp.published_at, bp.meta_title, bp.meta_description, bp.created_at,
              bc.name AS category_name, bc.slug AS category_slug,
              u.first_name AS author_first_name, u.last_name AS author_last_name
       FROM blog_posts bp
       INNER JOIN blog_categories bc ON bc.id = bp.category_id
       INNER JOIN users u ON u.id = bp.author_id
       ${whereClause}
       ORDER BY bp.published_at DESC, bp.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );

    return { posts: rows, total };
  }

  static async findBlogPostBySlug(slug: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT bp.*, bc.name AS category_name, bc.slug AS category_slug,
              u.first_name AS author_first_name, u.last_name AS author_last_name
       FROM blog_posts bp
       INNER JOIN blog_categories bc ON bc.id = bp.category_id
       INNER JOIN users u ON u.id = bp.author_id
       WHERE bp.slug = ?
       LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  }
}
