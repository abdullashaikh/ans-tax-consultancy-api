import { pool, RowDataPacket, ResultSetHeader } from '../config/database';
import { ServiceRecord, ServiceCategoryRecord, ServicePriceHistoryRecord } from '../types/models';

export class ServiceRepository {
  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  static async listCategories(activeOnly: boolean = true): Promise<ServiceCategoryRecord[]> {
    if (!pool || typeof pool.query !== 'function') return [];
    const condition = activeOnly
      ? 'WHERE (deleted_at IS NULL) AND is_active = 1'
      : 'WHERE deleted_at IS NULL';

    const query = `SELECT id, name, slug, description, icon, display_order, is_active, created_at, updated_at
                   FROM service_categories
                   ${condition}
                   ORDER BY display_order ASC, name ASC`;
    const [rows] = await pool.query<RowDataPacket[]>(query);
    return rows as ServiceCategoryRecord[];
  }

  static async findCategoryById(id: number): Promise<ServiceCategoryRecord | null> {
    if (!pool || typeof pool.query !== 'function') return null;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, slug, description, icon, display_order, is_active, created_at, updated_at
       FROM service_categories WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    return (rows[0] as ServiceCategoryRecord) || null;
  }

  static async findCategoryBySlug(slug: string): Promise<ServiceCategoryRecord | null> {
    if (!pool || typeof pool.query !== 'function') return null;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, slug, description, icon, display_order, is_active, created_at, updated_at
       FROM service_categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [slug]
    );
    return (rows[0] as ServiceCategoryRecord) || null;
  }

  static async createCategory(data: {
    name: string;
    slug: string;
    description?: string | null;
    icon?: string | null;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO service_categories (name, slug, description, icon, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.slug,
        data.description || null,
        data.icon || null,
        data.displayOrder || 0,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      ]
    );
    return result.insertId;
  }

  static async updateCategory(
    id: number,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
      icon?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      values.push(data.icon);
    }
    if (data.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(data.displayOrder);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (updates.length === 0) return;
    values.push(id);

    await pool.query(
      `UPDATE service_categories SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values
    );
  }

  static async deleteCategory(id: number): Promise<void> {
    await pool.query(
      `UPDATE service_categories SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE id = ?`,
      [id]
    );
  }

  // ==========================================================================
  // SERVICES
  // ==========================================================================

  static async listServices(params: {
    categoryId?: number;
    activeOnly?: boolean;
  }): Promise<(ServiceRecord & { category_name: string; category_slug: string })[]> {
    if (!pool || typeof pool.query !== 'function') return [];
    const conditions: string[] = ['s.deleted_at IS NULL'];
    const values: any[] = [];

    if (params.activeOnly !== false) {
      conditions.push('s.is_active = 1');
    }
    if (params.categoryId) {
      conditions.push('s.category_id = ?');
      values.push(params.categoryId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.category_id, s.name, s.slug, s.icon, s.short_description, s.description,
              s.features, s.eligibility, s.documents_required_description, s.processing_time,
              s.base_price, s.discount_price, s.currency, s.is_active, s.is_featured,
              s.display_order, s.created_at, s.updated_at,
              sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       INNER JOIN service_categories sc ON sc.id = s.category_id
       ${whereClause}
       ORDER BY s.display_order ASC, s.name ASC`,
      values
    );
    return rows as (ServiceRecord & { category_name: string; category_slug: string })[];
  }

  static async findServiceBySlug(
    slug: string
  ): Promise<(ServiceRecord & { category_name: string; category_slug: string }) | null> {
    if (!pool || typeof pool.query !== 'function') return null;

    // 1. Direct match on slug
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.category_id, s.name, s.slug, s.icon, s.short_description, s.description,
              s.features, s.eligibility, s.documents_required_description, s.processing_time,
              s.base_price, s.discount_price, s.currency, s.is_active, s.is_featured,
              s.display_order, s.created_at, s.updated_at,
              sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       INNER JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.slug = ? AND s.deleted_at IS NULL
       LIMIT 1`,
      [slug]
    );
    if (rows.length > 0) {
      return (rows[0] as (ServiceRecord & { category_name: string; category_slug: string }));
    }

    // 2. Common slug aliases mapping
    const aliases: Record<string, string[]> = {
      'income-tax-filing': ['itr-filing', 'income-tax', 'itr', 'income-tax-return'],
      'itr-filing': ['income-tax-filing'],
      'gst-services': ['gst-registration', 'gst-return-filing', 'gst', 'gst-filing'],
      'gst-registration': ['gst-services'],
      'roc-compliance': ['roc-annual-compliance', 'roc', 'corporate-compliance', 'mca-compliance'],
      'roc-annual-compliance': ['roc-compliance'],
      'company-registration': ['company-incorporation', 'private-limited-company-registration', 'llp-registration', 'business-incorporation'],
      'statutory-registrations': ['udyam-registration', 'business-registrations', 'statutory-licenses'],
      'accounting-bookkeeping': ['bookkeeping-accounting', 'payroll-processing', 'accounting', 'bookkeeping'],
    };

    const targetAliases = aliases[slug] || [];
    for (const alias of targetAliases) {
      const [aliasRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.category_id, s.name, s.slug, s.icon, s.short_description, s.description,
                s.features, s.eligibility, s.documents_required_description, s.processing_time,
                s.base_price, s.discount_price, s.currency, s.is_active, s.is_featured,
                s.display_order, s.created_at, s.updated_at,
                sc.name AS category_name, sc.slug AS category_slug
         FROM services s
         INNER JOIN service_categories sc ON sc.id = s.category_id
         WHERE s.slug = ? AND s.deleted_at IS NULL
         LIMIT 1`,
        [alias]
      );
      if (aliasRows.length > 0) {
        return (aliasRows[0] as (ServiceRecord & { category_name: string; category_slug: string }));
      }
    }

    // 3. Category match fallback: if the slug is a category name, return its flagship service
    const [catRows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.category_id, s.name, s.slug, s.icon, s.short_description, s.description,
              s.features, s.eligibility, s.documents_required_description, s.processing_time,
              s.base_price, s.discount_price, s.currency, s.is_active, s.is_featured,
              s.display_order, s.created_at, s.updated_at,
              sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       INNER JOIN service_categories sc ON sc.id = s.category_id
       WHERE (sc.slug = ? OR sc.slug LIKE ?) AND s.deleted_at IS NULL AND s.is_active = 1
       ORDER BY s.display_order ASC
       LIMIT 1`,
      [slug, `%${slug}%`]
    );
    if (catRows.length > 0) {
      return (catRows[0] as (ServiceRecord & { category_name: string; category_slug: string }));
    }

    return null;
  }

  static async findServiceById(id: number): Promise<ServiceRecord | null> {
    if (!pool || typeof pool.query !== 'function') return null;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.category_id, s.name, s.slug, s.icon, s.short_description, s.description,
              s.features, s.eligibility, s.documents_required_description, s.processing_time,
              s.base_price, s.discount_price, s.currency, s.is_active, s.is_featured,
              s.display_order, s.created_at, s.updated_at
       FROM services s
       WHERE s.id = ? AND s.deleted_at IS NULL LIMIT 1`,
      [id]
    );
    return (rows[0] as ServiceRecord) || null;
  }

  static async createService(data: {
    categoryId: number;
    name: string;
    slug: string;
    icon?: string | null;
    shortDescription?: string | null;
    description?: string | null;
    features?: any | null;
    eligibility?: string | null;
    documentsRequiredDescription?: string | null;
    processingTime?: string | null;
    basePrice?: number | null;
    discountPrice?: number | null;
    currency?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    displayOrder?: number;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO services (
        category_id, name, slug, icon, short_description, description, features,
        eligibility, documents_required_description, processing_time,
        base_price, discount_price, currency, is_active, is_featured, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.categoryId,
        data.name,
        data.slug,
        data.icon || null,
        data.shortDescription || null,
        data.description || null,
        data.features ? JSON.stringify(data.features) : null,
        data.eligibility || null,
        data.documentsRequiredDescription || null,
        data.processingTime || null,
        data.basePrice !== undefined ? data.basePrice : null,
        data.discountPrice !== undefined ? data.discountPrice : null,
        data.currency || 'INR',
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
        data.isFeatured ? 1 : 0,
        data.displayOrder || 0,
      ]
    );
    return result.insertId;
  }

  static async updateService(
    id: number,
    data: {
      categoryId?: number;
      name?: string;
      slug?: string;
      icon?: string | null;
      shortDescription?: string | null;
      description?: string | null;
      features?: any | null;
      eligibility?: string | null;
      documentsRequiredDescription?: string | null;
      processingTime?: string | null;
      basePrice?: number | null;
      discountPrice?: number | null;
      currency?: string;
      isActive?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.categoryId !== undefined) {
      updates.push('category_id = ?');
      values.push(data.categoryId);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      values.push(data.slug);
    }
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      values.push(data.icon);
    }
    if (data.shortDescription !== undefined) {
      updates.push('short_description = ?');
      values.push(data.shortDescription);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.features !== undefined) {
      updates.push('features = ?');
      values.push(data.features ? JSON.stringify(data.features) : null);
    }
    if (data.eligibility !== undefined) {
      updates.push('eligibility = ?');
      values.push(data.eligibility);
    }
    if (data.documentsRequiredDescription !== undefined) {
      updates.push('documents_required_description = ?');
      values.push(data.documentsRequiredDescription);
    }
    if (data.processingTime !== undefined) {
      updates.push('processing_time = ?');
      values.push(data.processingTime);
    }
    if (data.basePrice !== undefined) {
      updates.push('base_price = ?');
      values.push(data.basePrice);
    }
    if (data.discountPrice !== undefined) {
      updates.push('discount_price = ?');
      values.push(data.discountPrice);
    }
    if (data.currency !== undefined) {
      updates.push('currency = ?');
      values.push(data.currency);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    if (data.isFeatured !== undefined) {
      updates.push('is_featured = ?');
      values.push(data.isFeatured ? 1 : 0);
    }
    if (data.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(data.displayOrder);
    }

    if (updates.length === 0) return;
    values.push(id);

    await pool.query(
      `UPDATE services SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values
    );
  }

  static async deleteService(id: number): Promise<void> {
    await pool.query(
      `UPDATE services SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE id = ?`,
      [id]
    );
  }

  // ==========================================================================
  // PRICE HISTORY
  // ==========================================================================

  static async recordPriceHistory(data: {
    serviceId: number;
    previousBasePrice: number | null;
    newBasePrice: number;
    previousDiscountPrice?: number | null;
    newDiscountPrice?: number | null;
    currency?: string;
    changedBy?: number | null;
    reason?: string | null;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO service_price_history (
        service_id, previous_base_price, new_base_price,
        previous_discount_price, new_discount_price, currency,
        changed_by, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.serviceId,
        data.previousBasePrice,
        data.newBasePrice,
        data.previousDiscountPrice || null,
        data.newDiscountPrice || null,
        data.currency || 'INR',
        data.changedBy || null,
        data.reason || null,
      ]
    );
    return result.insertId;
  }

  static async listPriceHistory(serviceId: number): Promise<ServicePriceHistoryRecord[]> {
    if (!pool || typeof pool.query !== 'function') return [];
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sph.*, CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
       FROM service_price_history sph
       LEFT JOIN users u ON u.id = sph.changed_by
       WHERE sph.service_id = ?
       ORDER BY sph.created_at DESC`,
      [serviceId]
    );
    return rows as ServicePriceHistoryRecord[];
  }
}
