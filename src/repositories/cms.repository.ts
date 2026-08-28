import { pool, RowDataPacket } from '../config/database';
import { WebsiteContentRecord } from '../types/models';

export class CmsRepository {
  // ==========================================================================
  // WEBSITE CONTENT CMS
  // ==========================================================================

  static async listPublished(sectionKey?: string): Promise<WebsiteContentRecord[]> {
    if (!pool || typeof pool.query !== 'function') return [];
    let query = `SELECT id, section_key, content_key, content_value, content_type,
                        display_order, is_published, updated_by, created_at, updated_at
                 FROM website_contents
                 WHERE is_published = 1`;
    const params: any[] = [];

    if (sectionKey) {
      query += ` AND section_key = ?`;
      params.push(sectionKey);
    }

    query += ` ORDER BY section_key ASC, display_order ASC, content_key ASC`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows as WebsiteContentRecord[];
  }

  static async listAll(): Promise<WebsiteContentRecord[]> {
    if (!pool || typeof pool.query !== 'function') return [];
    const query = `SELECT id, section_key, content_key, content_value, content_type,
                          display_order, is_published, updated_by, created_at, updated_at
                   FROM website_contents
                   ORDER BY section_key ASC, display_order ASC, content_key ASC`;
    const [rows] = await pool.query<RowDataPacket[]>(query);
    return rows as WebsiteContentRecord[];
  }

  static async upsertContent(data: {
    sectionKey: string;
    contentKey: string;
    contentValue: string | null;
    contentType?: string;
    displayOrder?: number;
    isPublished?: boolean;
    updatedBy?: number | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO website_contents (
        section_key, content_key, content_value, content_type,
        display_order, is_published, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        content_value = VALUES(content_value),
        content_type = COALESCE(VALUES(content_type), content_type),
        display_order = COALESCE(VALUES(display_order), display_order),
        is_published = COALESCE(VALUES(is_published), is_published),
        updated_by = VALUES(updated_by),
        updated_at = UTC_TIMESTAMP()`,
      [
        data.sectionKey,
        data.contentKey,
        data.contentValue || null,
        data.contentType || 'TEXT',
        data.displayOrder !== undefined ? data.displayOrder : 0,
        data.isPublished !== undefined ? (data.isPublished ? 1 : 0) : 1,
        data.updatedBy || null,
      ]
    );
  }

  // ==========================================================================
  // FAQS & BLOG POSTS
  // ==========================================================================

  static async listFaqs(serviceId?: number): Promise<RowDataPacket[]> {
    if (!pool || typeof pool.query !== 'function') return [];
    let query = `SELECT id, service_id, question, answer, display_order FROM faqs WHERE is_active = 1`;
    const params: any[] = [];
    if (serviceId) {
      query += ` AND (service_id = ? OR service_id IS NULL)`;
      params.push(serviceId);
    }
    query += ` ORDER BY display_order ASC, id ASC`;
    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows;
  }

  static async listBlogPosts(params: {
    categoryId?: number;
    limit: number;
    offset: number;
  }): Promise<{ posts: RowDataPacket[]; total: number }> {
    if (!pool || typeof pool.query !== 'function') return { posts: [], total: 0 };
    const conditions = [`status = 'PUBLISHED'`];
    const values: any[] = [];
    if (params.categoryId) {
      conditions.push('category_id = ?');
      values.push(params.categoryId);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM blog_posts ${where}`,
      values
    );
    const total = countRows[0]?.['total'] || 0;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, category_id, title, slug, excerpt, featured_image, published_at
       FROM blog_posts ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
      [...values, params.limit, params.offset]
    );
    return { posts: rows, total };
  }

  static async findBlogPostBySlug(slug: string): Promise<RowDataPacket | null> {
    if (!pool || typeof pool.query !== 'function') return null;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT bp.*, bc.name AS category_name, bc.slug AS category_slug,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name
       FROM blog_posts bp
       INNER JOIN blog_categories bc ON bc.id = bp.category_id
       INNER JOIN users u ON u.id = bp.author_id
       WHERE bp.slug = ? AND bp.status = 'PUBLISHED' LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  }
}
