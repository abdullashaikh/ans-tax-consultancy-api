import { pool } from '../config/database';
import {
  ServiceRecord,
  ServiceCategoryRecord,
  ServiceRegion,
  CategoryRegion,
  ServicePriceHistoryRecord,
  ServiceFaqRecord,
  ServiceDocumentRecord,
  ServiceProcessStepRecord,
  ServiceRelatedServiceRecord,
} from '../types/models';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface ServiceListFilter {
  categoryId?: number;
  categorySlug?: string;
  region?: string;
  search?: string;
  featured?: boolean;
  activeOnly?: boolean;
  page?: number;
  limit?: number;
}

export class ServiceRepository {
  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  static async listCategories(params?: {
    activeOnly?: boolean;
    region?: string;
  }): Promise<Array<ServiceCategoryRecord & { service_count: number }>> {
    let sql = `
      SELECT
        sc.*,
        COUNT(s.id) AS service_count
      FROM service_categories sc
      LEFT JOIN services s ON s.category_id = sc.id AND s.deleted_at IS NULL AND s.is_active = 1
    `;
    const conditions: string[] = ['sc.deleted_at IS NULL'];
    const values: any[] = [];

    if (params?.activeOnly !== false) {
      conditions.push('sc.is_active = 1');
    }

    if (params?.region) {
      const reg = params.region.toUpperCase();
      conditions.push('(sc.region = ? OR sc.region = "GLOBAL")');
      values.push(reg);
    }

    sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` GROUP BY sc.id ORDER BY sc.display_order ASC, sc.name ASC`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, values);
    return rows.map((r) => ({
      ...r,
      id: Number(r['id']),
      is_active: Boolean(r['is_active']),
      service_count: Number(r['service_count'] || 0),
    })) as Array<ServiceCategoryRecord & { service_count: number }>;
  }

  static async findCategoryById(id: number): Promise<ServiceCategoryRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM service_categories WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0]!;
    return { ...r, id: Number(r['id']), is_active: Boolean(r['is_active']) } as ServiceCategoryRecord;
  }

  static async findCategoryBySlug(slug: string, region?: string): Promise<ServiceCategoryRecord | null> {
    let sql = `SELECT * FROM service_categories WHERE slug = ? AND deleted_at IS NULL`;
    const values: any[] = [slug];

    if (region) {
      sql += ` AND (region = ? OR region = 'GLOBAL')`;
      values.push(region.toUpperCase());
    }
    sql += ` LIMIT 1`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, values);
    if (!rows || rows.length === 0) return null;
    const r = rows[0]!;
    return { ...r, id: Number(r['id']), is_active: Boolean(r['is_active']) } as ServiceCategoryRecord;
  }

  static async countServicesByCategoryId(categoryId: number, activeOnly: boolean = true): Promise<number> {
    let sql = `SELECT COUNT(*) AS total FROM services WHERE category_id = ? AND deleted_at IS NULL`;
    if (activeOnly) {
      sql += ` AND is_active = 1`;
    }
    const [rows] = await pool.query<RowDataPacket[]>(sql, [categoryId]);
    return Number(rows[0]?.['total'] || 0);
  }

  static async createCategory(data: {
    name: string;
    slug: string;
    region?: CategoryRegion;
    description?: string | null;
    icon?: string | null;
    displayOrder?: number;
    isActive?: boolean;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO service_categories (name, slug, region, description, icon, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.slug,
        data.region || 'INDIA',
        data.description || null,
        data.icon || null,
        data.displayOrder ?? 0,
        data.isActive !== false ? 1 : 0,
      ]
    );
    return result.insertId;
  }

  static async updateCategory(
    id: number,
    data: {
      name?: string;
      slug?: string;
      region?: CategoryRegion;
      description?: string | null;
      icon?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
    if (data.region !== undefined) { fields.push('region = ?'); values.push(data.region); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
    if (data.displayOrder !== undefined) { fields.push('display_order = ?'); values.push(data.displayOrder); }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }

    if (fields.length === 0) return;

    values.push(id);
    await pool.query(`UPDATE service_categories SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  static async deleteCategory(id: number): Promise<void> {
    await pool.query(
      `UPDATE service_categories SET deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ?`,
      [id]
    );
  }

  // ==========================================================================
  // SERVICES
  // ==========================================================================

  private static parseJsonField(val: any, defaultVal: any = null): any {
    if (!val) return defaultVal;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return defaultVal;
    }
  }

  private static mapServiceRow(r: RowDataPacket): ServiceRecord {
    return {
      id: Number(r['id']),
      som_number: r['som_number'] !== undefined && r['som_number'] !== null ? Number(r['som_number']) : null,
      category_id: Number(r['category_id']),
      name: r['name'],
      slug: r['slug'],
      region: r['region'] || 'INDIA',
      icon: r['icon'] || null,
      short_description: r['short_description'] || null,
      description: r['description'] || null,
      features: this.parseJsonField(r['features'], null),
      overview: r['overview'] || null,
      eligibility: r['eligibility'] || null,
      documents_required_description: r['documents_required_description'] || null,
      required_documents: this.parseJsonField(r['required_documents'], []),
      deliverables: this.parseJsonField(r['deliverables'], []),
      process_steps: this.parseJsonField(r['process_steps'], []),
      processing_time: r['processing_time'] || null,
      turnaround: r['turnaround'] || r['processing_time'] || null,
      base_price: r['base_price'] !== null ? String(r['base_price']) : null,
      discount_price: r['discount_price'] ? String(r['discount_price']) : (r['promo_price'] ? String(r['promo_price']) : null),
      promo_price: r['promo_price'] ? String(r['promo_price']) : (r['discount_price'] ? String(r['discount_price']) : null),
      pricing_notes: r['pricing_notes'] || null,
      exclusions: this.parseJsonField(r['exclusions'], []),
      related_service_ids: this.parseJsonField(r['related_service_ids'], []),
      seo_title: r['seo_title'] || null,
      meta_description: r['meta_description'] || null,
      h1_heading: r['h1_heading'] || null,
      primary_cta_text: r['primary_cta_text'] || 'Book Consultation',
      primary_cta_link: r['primary_cta_link'] || null,
      cta_type: r['cta_type'] || 'CONSULTATION',
      currency: r['currency'] || (r['region'] === 'UAE' ? 'AED' : 'INR'),
      billing_period: r['billing_period'] || 'one-time',
      pricing_mode: r['pricing_mode'] || 'FIXED',
      is_active: Boolean(r['is_active']),
      is_featured: Boolean(r['is_featured']),
      display_order: Number(r['display_order'] || 0),
      created_at: r['created_at'],
      updated_at: r['updated_at'],
      deleted_at: r['deleted_at'] || null,
    };
  }

  static async listServices(params: ServiceListFilter): Promise<{
    services: Array<ServiceRecord & { category_name?: string; category_slug?: string }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(150, Math.max(1, params.limit || 50));
    const offset = (page - 1) * limit;

    let baseSql = `
      FROM services s
      INNER JOIN service_categories sc ON sc.id = s.category_id
      WHERE s.deleted_at IS NULL
    `;
    const values: any[] = [];

    if (params.activeOnly !== false) {
      baseSql += ` AND s.is_active = 1 AND sc.is_active = 1`;
    }

    if (params.region) {
      baseSql += ` AND s.region = ?`;
      values.push(params.region.toUpperCase());
    }

    if (params.categoryId) {
      baseSql += ` AND s.category_id = ?`;
      values.push(params.categoryId);
    }

    if (params.categorySlug) {
      baseSql += ` AND sc.slug = ?`;
      values.push(params.categorySlug);
    }

    if (params.featured !== undefined) {
      baseSql += ` AND s.is_featured = ?`;
      values.push(params.featured ? 1 : 0);
    }

    if (params.search && params.search.trim().length > 0) {
      const term = `%${params.search.trim()}%`;
      baseSql += ` AND (
        s.name LIKE ? OR
        s.slug LIKE ? OR
        s.short_description LIKE ? OR
        s.description LIKE ? OR
        sc.name LIKE ?
      )`;
      values.push(term, term, term, term, term);
    }

    const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total ${baseSql}`, values);
    const total = Number(countRows[0]?.['total'] || 0);

    const selectSql = `
      SELECT
        s.*,
        sc.name AS category_name,
        sc.slug AS category_slug
      ${baseSql}
      ORDER BY s.som_number ASC, s.display_order ASC, s.name ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query<RowDataPacket[]>(selectSql, [...values, limit, offset]);

    const services = rows.map((r) => {
      const svc = this.mapServiceRow(r);
      return {
        ...svc,
        category_name: r['category_name'],
        category_slug: r['category_slug'],
      };
    });

    return {
      services,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  static async findServiceById(id: number): Promise<ServiceRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       LEFT JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.id = ? AND s.deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0]!;
    const svc = this.mapServiceRow(r);
    return {
      ...svc,
      category_name: r['category_name'],
      category_slug: r['category_slug'],
    } as any;
  }

  static async findServiceBySomNumber(somNumber: number): Promise<ServiceRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       LEFT JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.som_number = ? AND s.deleted_at IS NULL LIMIT 1`,
      [somNumber]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0]!;
    const svc = this.mapServiceRow(r);
    return {
      ...svc,
      category_name: r['category_name'],
      category_slug: r['category_slug'],
    } as any;
  }

  // ==========================================================================
  // CHILD ENTITIES: FAQS, DOCUMENTS, PROCESS STEPS, RELATED SERVICES
  // ==========================================================================

  static async getServiceFaqs(serviceId: number, activeOnly: boolean = true): Promise<ServiceFaqRecord[]> {
    let sql = `SELECT * FROM service_faqs WHERE service_id = ?`;
    if (activeOnly) sql += ` AND is_active = 1`;
    sql += ` ORDER BY display_order ASC, id ASC`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, [serviceId]);
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r['id'],
        service_id: r['service_id'],
        question: r['question'],
        answer: r['answer'],
        display_order: Number(r['display_order'] || 0),
        is_active: Boolean(r['is_active']),
        created_at: r['created_at'],
        updated_at: r['updated_at'],
      }));
    }

    // Fallback to legacy faqs table if service_faqs has not yet been populated
    const [legacyRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM faqs WHERE service_id = ? ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY display_order ASC`,
      [serviceId]
    );
    return legacyRows.map((r) => ({
      id: r['id'],
      service_id: r['service_id'],
      question: r['question'],
      answer: r['answer'],
      display_order: Number(r['display_order'] || 0),
      is_active: Boolean(r['is_active']),
      created_at: r['created_at'],
      updated_at: r['updated_at'],
    }));
  }

  static async getServiceDocuments(serviceId: number): Promise<ServiceDocumentRecord[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM service_documents WHERE service_id = ? ORDER BY display_order ASC, id ASC`,
      [serviceId]
    );
    return rows.map((r) => ({
      id: r['id'],
      service_id: r['service_id'],
      document_name: r['document_name'],
      description: r['description'] || null,
      is_required: Boolean(r['is_required']),
      display_order: Number(r['display_order'] || 0),
      created_at: r['created_at'],
      updated_at: r['updated_at'],
    }));
  }

  static async getServiceProcessSteps(serviceId: number): Promise<ServiceProcessStepRecord[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM service_process_steps WHERE service_id = ? ORDER BY step_number ASC, id ASC`,
      [serviceId]
    );
    return rows.map((r) => ({
      id: r['id'],
      service_id: r['service_id'],
      step_number: Number(r['step_number'] || 1),
      title: r['title'],
      description: r['description'],
      created_at: r['created_at'],
      updated_at: r['updated_at'],
    }));
  }

  static async getRelatedServices(
    serviceId: number,
    activeOnly: boolean = true
  ): Promise<ServiceRelatedServiceRecord[]> {
    let sql = `
      SELECT
        srs.id,
        srs.service_id,
        srs.related_service_id,
        srs.display_order,
        srs.created_at,
        s.name AS related_service_name,
        s.slug AS related_service_slug,
        s.region AS related_service_region,
        s.base_price AS related_service_base_price,
        s.currency AS related_service_currency
      FROM service_related_services srs
      INNER JOIN services s ON s.id = srs.related_service_id AND s.deleted_at IS NULL
      WHERE srs.service_id = ?
    `;
    if (activeOnly) {
      sql += ` AND s.is_active = 1`;
    }
    sql += ` ORDER BY srs.display_order ASC, srs.id ASC`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, [serviceId]);
    return rows.map((r) => ({
      id: r['id'],
      service_id: r['service_id'],
      related_service_id: r['related_service_id'],
      display_order: Number(r['display_order'] || 0),
      created_at: r['created_at'],
      related_service_name: r['related_service_name'],
      related_service_slug: r['related_service_slug'],
      related_service_region: r['related_service_region'],
      related_service_base_price: r['related_service_base_price'] ? String(r['related_service_base_price']) : null,
      related_service_currency: r['related_service_currency'] || 'INR',
    }));
  }

  // --- Syncing child tables ---

  static async syncServiceFaqs(
    serviceId: number,
    faqs: Array<{ question: string; answer: string; displayOrder?: number; isActive?: boolean }>
  ): Promise<void> {
    await pool.query(`DELETE FROM service_faqs WHERE service_id = ?`, [serviceId]);
    if (!faqs || faqs.length === 0) return;

    for (let i = 0; i < faqs.length; i++) {
      const f = faqs[i]!;
      if (!f.question?.trim() || !f.answer?.trim()) continue;
      await pool.query(
        `INSERT INTO service_faqs (service_id, question, answer, display_order, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [serviceId, f.question.trim(), f.answer.trim(), f.displayOrder ?? i + 1, f.isActive !== false ? 1 : 0]
      );
    }
  }

  static async syncServiceDocuments(
    serviceId: number,
    documents: Array<{ name: string; description?: string | null; isRequired?: boolean; displayOrder?: number }>
  ): Promise<void> {
    await pool.query(`DELETE FROM service_documents WHERE service_id = ?`, [serviceId]);
    if (!documents || documents.length === 0) return;

    for (let i = 0; i < documents.length; i++) {
      const d = documents[i]!;
      if (!d.name?.trim()) continue;
      await pool.query(
        `INSERT INTO service_documents (service_id, document_name, description, is_required, display_order)
         VALUES (?, ?, ?, ?, ?)`,
        [serviceId, d.name.trim(), d.description || null, d.isRequired !== false ? 1 : 0, d.displayOrder ?? i + 1]
      );
    }
  }

  static async syncServiceProcessSteps(
    serviceId: number,
    steps: Array<{ stepNumber?: number; title: string; description: string }>
  ): Promise<void> {
    await pool.query(`DELETE FROM service_process_steps WHERE service_id = ?`, [serviceId]);
    if (!steps || steps.length === 0) return;

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!;
      if (!s.title?.trim()) continue;
      await pool.query(
        `INSERT INTO service_process_steps (service_id, step_number, title, description)
         VALUES (?, ?, ?, ?)`,
        [serviceId, s.stepNumber ?? i + 1, s.title.trim(), s.description || '']
      );
    }
  }

  static async syncRelatedServices(serviceId: number, relatedIds: number[]): Promise<void> {
    await pool.query(`DELETE FROM service_related_services WHERE service_id = ?`, [serviceId]);
    if (!relatedIds || relatedIds.length === 0) return;

    const uniqueIds = Array.from(new Set(relatedIds.filter((id) => id !== serviceId)));
    for (let i = 0; i < uniqueIds.length; i++) {
      const rId = uniqueIds[i]!;
      await pool.query(
        `INSERT IGNORE INTO service_related_services (service_id, related_service_id, display_order)
         VALUES (?, ?, ?)`,
        [serviceId, rId, i + 1]
      );
    }
  }

  // ==========================================================================
  // REGIONAL SLUG RESOLUTION & FULL DETAIL
  // ==========================================================================

  static async findServiceByRegionAndSlug(
    region: string,
    slug: string,
    activeOnly: boolean = true
  ): Promise<any | null> {
    const normRegion = region.toUpperCase();
    const cleanSlug = slug.toLowerCase().replace(/^\/+|\/+$/g, '');

    let sql = `
      SELECT
        s.*,
        sc.id AS cat_id,
        sc.name AS category_name,
        sc.slug AS category_slug
      FROM services s
      INNER JOIN service_categories sc ON sc.id = s.category_id
      WHERE s.region = ? AND s.slug = ? AND s.deleted_at IS NULL
    `;
    if (activeOnly) {
      sql += ` AND s.is_active = 1 AND sc.is_active = 1`;
    }
    sql += ` LIMIT 1`;

    let [rows] = await pool.query<RowDataPacket[]>(sql, [normRegion, cleanSlug]);

    // Fallback: handle common alias or missing prefix
    if (!rows || rows.length === 0) {
      const fallbackSql = `
        SELECT s.*, sc.id AS cat_id, sc.name AS category_name, sc.slug AS category_slug
        FROM services s
        INNER JOIN service_categories sc ON sc.id = s.category_id
        WHERE s.region = ? AND s.slug LIKE ? AND s.deleted_at IS NULL
        ${activeOnly ? 'AND s.is_active = 1 AND sc.is_active = 1' : ''}
        LIMIT 1
      `;
      [rows] = await pool.query<RowDataPacket[]>(fallbackSql, [normRegion, `%${cleanSlug}%`]);
    }

    if (!rows || rows.length === 0) return null;

    const r = rows[0]!;
    const svc = this.mapServiceRow(r);

    // Fetch normalized child entities in parallel
    const [faqs, dbDocs, dbSteps, related] = await Promise.all([
      this.getServiceFaqs(svc.id, activeOnly),
      this.getServiceDocuments(svc.id),
      this.getServiceProcessSteps(svc.id),
      this.getRelatedServices(svc.id, activeOnly),
    ]);

    // Format documents: combine normalized table rows or JSON fallback
    const documents = dbDocs.length > 0
      ? dbDocs.map((d) => ({ name: d.document_name, description: d.description, isRequired: d.is_required }))
      : (Array.isArray(svc.required_documents) ? svc.required_documents : []);

    // Format process steps: combine normalized table rows or JSON fallback
    const processSteps = dbSteps.length > 0
      ? dbSteps.map((s) => ({ step: s.step_number, title: s.title, description: s.description }))
      : (Array.isArray(svc.process_steps) && svc.process_steps.length > 0 ? svc.process_steps : []);

    // Format related services
    let formattedRelated: any[] = [];
    if (related.length > 0) {
      formattedRelated = related.map((rel) => ({
        id: rel.related_service_id,
        name: rel.related_service_name,
        slug: rel.related_service_slug,
        region: rel.related_service_region,
        basePrice: rel.related_service_base_price,
        currency: rel.related_service_currency,
      }));
    } else if (svc.related_service_ids && svc.related_service_ids.length > 0) {
      const [relRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, slug, region, base_price, currency FROM services WHERE id IN (?) AND deleted_at IS NULL AND is_active = 1`,
        [svc.related_service_ids]
      );
      formattedRelated = relRows.map((rel) => ({
        id: rel['id'],
        name: rel['name'],
        slug: rel['slug'],
        region: rel['region'],
        basePrice: rel['base_price'] ? String(rel['base_price']) : null,
        currency: rel['currency'],
      }));
    }

    return {
      ...svc,
      category_id: r['cat_id'],
      category_name: r['category_name'],
      category_slug: r['category_slug'],
      faqs,
      structured_documents: documents,
      structured_process_steps: processSteps,
      related_services_resolved: formattedRelated,
    };
  }

  static async findServiceBySlug(slug: string): Promise<ServiceRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, sc.name AS category_name, sc.slug AS category_slug
       FROM services s
       LEFT JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.slug = ? AND s.deleted_at IS NULL LIMIT 1`,
      [slug]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0]!;
    const svc = this.mapServiceRow(r);
    return {
      ...svc,
      category_name: r['category_name'],
      category_slug: r['category_slug'],
    } as any;
  }

  static async createService(data: {
    somNumber?: number | null;
    categoryId: number;
    name: string;
    slug: string;
    region?: ServiceRegion;
    icon?: string | null;
    shortDescription?: string | null;
    description?: string | null;
    features?: any | null;
    overview?: string | null;
    eligibility?: string | null;
    documentsRequiredDescription?: string | null;
    requiredDocuments?: any | null;
    deliverables?: any | null;
    processSteps?: any | null;
    processingTime?: string | null;
    turnaround?: string | null;
    basePrice?: number | null;
    discountPrice?: number | null;
    promoPrice?: number | null;
    pricingNotes?: string | null;
    exclusions?: any | null;
    relatedServiceIds?: number[] | null;
    seoTitle?: string | null;
    metaDescription?: string | null;
    h1Heading?: string | null;
    primaryCtaText?: string | null;
    primaryCtaLink?: string | null;
    ctaType?: string | null;
    currency?: string;
    billingPeriod?: string;
    pricingMode?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    displayOrder?: number;
    faqs?: Array<{ question: string; answer: string; displayOrder?: number }>;
    documentsList?: Array<{ name: string; description?: string; isRequired?: boolean }>;
    processStepsList?: Array<{ stepNumber?: number; title: string; description: string }>;
  }): Promise<number> {
    const region = data.region || 'INDIA';
    const currency = data.currency || (region === 'UAE' ? 'AED' : 'INR');
    const billingPeriod = data.billingPeriod || 'one-time';
    const pricingMode = data.pricingMode || (data.basePrice === null || data.basePrice === undefined ? 'CUSTOM_QUOTE' : 'FIXED');

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO services (
        som_number, category_id, name, slug, region, icon, short_description, description,
        features, overview, eligibility, documents_required_description,
        required_documents, deliverables, process_steps, processing_time, turnaround,
        base_price, discount_price, promo_price, pricing_notes, exclusions,
        related_service_ids, seo_title, meta_description, h1_heading,
        primary_cta_text, primary_cta_link, cta_type, currency, billing_period,
        pricing_mode, is_active, is_featured, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.somNumber || null,
        data.categoryId,
        data.name,
        data.slug,
        region,
        data.icon || null,
        data.shortDescription || null,
        data.description || null,
        data.features ? JSON.stringify(data.features) : null,
        data.overview || null,
        data.eligibility || null,
        data.documentsRequiredDescription || null,
        data.requiredDocuments ? JSON.stringify(data.requiredDocuments) : null,
        data.deliverables ? JSON.stringify(data.deliverables) : null,
        data.processSteps ? JSON.stringify(data.processSteps) : null,
        data.processingTime || data.turnaround || null,
        data.turnaround || data.processingTime || null,
        data.basePrice !== undefined ? data.basePrice : null,
        data.discountPrice !== undefined ? data.discountPrice : (data.promoPrice !== undefined ? data.promoPrice : null),
        data.promoPrice !== undefined ? data.promoPrice : (data.discountPrice !== undefined ? data.discountPrice : null),
        data.pricingNotes || null,
        data.exclusions ? JSON.stringify(data.exclusions) : null,
        data.relatedServiceIds ? JSON.stringify(data.relatedServiceIds) : null,
        data.seoTitle || null,
        data.metaDescription || null,
        data.h1Heading || null,
        data.primaryCtaText || 'Book Consultation',
        data.primaryCtaLink || null,
        data.ctaType || 'CONSULTATION',
        currency,
        billingPeriod,
        pricingMode,
        data.isActive !== false ? 1 : 0,
        data.isFeatured ? 1 : 0,
        data.displayOrder ?? 0,
      ]
    );

    const serviceId = result.insertId;

    // Sync child entities if provided
    if (data.faqs && data.faqs.length > 0) {
      await this.syncServiceFaqs(serviceId, data.faqs);
    }
    if (data.documentsList && data.documentsList.length > 0) {
      await this.syncServiceDocuments(serviceId, data.documentsList);
    }
    if (data.processStepsList && data.processStepsList.length > 0) {
      await this.syncServiceProcessSteps(serviceId, data.processStepsList);
    }
    if (data.relatedServiceIds && data.relatedServiceIds.length > 0) {
      await this.syncRelatedServices(serviceId, data.relatedServiceIds);
    }

    return serviceId;
  }

  static async updateService(
    id: number,
    data: {
      somNumber?: number | null;
      categoryId?: number;
      name?: string;
      slug?: string;
      region?: ServiceRegion;
      icon?: string | null;
      shortDescription?: string | null;
      description?: string | null;
      features?: any | null;
      overview?: string | null;
      eligibility?: string | null;
      documentsRequiredDescription?: string | null;
      requiredDocuments?: any | null;
      deliverables?: any | null;
      processSteps?: any | null;
      processingTime?: string | null;
      turnaround?: string | null;
      basePrice?: number | null;
      discountPrice?: number | null;
      promoPrice?: number | null;
      pricingNotes?: string | null;
      exclusions?: any | null;
      relatedServiceIds?: number[] | null;
      seoTitle?: string | null;
      metaDescription?: string | null;
      h1Heading?: string | null;
      primaryCtaText?: string | null;
      primaryCtaLink?: string | null;
      ctaType?: string | null;
      currency?: string;
      billingPeriod?: string;
      pricingMode?: string;
      isActive?: boolean;
      isFeatured?: boolean;
      displayOrder?: number;
      faqs?: Array<{ question: string; answer: string; displayOrder?: number }>;
      documentsList?: Array<{ name: string; description?: string; isRequired?: boolean }>;
      processStepsList?: Array<{ stepNumber?: number; title: string; description: string }>;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.somNumber !== undefined) { fields.push('som_number = ?'); values.push(data.somNumber); }
    if (data.categoryId !== undefined) { fields.push('category_id = ?'); values.push(data.categoryId); }
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
    if (data.region !== undefined) { fields.push('region = ?'); values.push(data.region); }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
    if (data.shortDescription !== undefined) { fields.push('short_description = ?'); values.push(data.shortDescription); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.features !== undefined) { fields.push('features = ?'); values.push(data.features ? JSON.stringify(data.features) : null); }
    if (data.overview !== undefined) { fields.push('overview = ?'); values.push(data.overview); }
    if (data.eligibility !== undefined) { fields.push('eligibility = ?'); values.push(data.eligibility); }
    if (data.documentsRequiredDescription !== undefined) { fields.push('documents_required_description = ?'); values.push(data.documentsRequiredDescription); }
    if (data.requiredDocuments !== undefined) { fields.push('required_documents = ?'); values.push(data.requiredDocuments ? JSON.stringify(data.requiredDocuments) : null); }
    if (data.deliverables !== undefined) { fields.push('deliverables = ?'); values.push(data.deliverables ? JSON.stringify(data.deliverables) : null); }
    if (data.processSteps !== undefined) { fields.push('process_steps = ?'); values.push(data.processSteps ? JSON.stringify(data.processSteps) : null); }
    if (data.processingTime !== undefined) { fields.push('processing_time = ?'); values.push(data.processingTime); }
    if (data.turnaround !== undefined) { fields.push('turnaround = ?'); values.push(data.turnaround); }
    if (data.basePrice !== undefined) { fields.push('base_price = ?'); values.push(data.basePrice); }
    if (data.discountPrice !== undefined) { fields.push('discount_price = ?'); values.push(data.discountPrice); }
    if (data.promoPrice !== undefined) { fields.push('promo_price = ?'); values.push(data.promoPrice); }
    if (data.pricingNotes !== undefined) { fields.push('pricing_notes = ?'); values.push(data.pricingNotes); }
    if (data.exclusions !== undefined) { fields.push('exclusions = ?'); values.push(data.exclusions ? JSON.stringify(data.exclusions) : null); }
    if (data.relatedServiceIds !== undefined) { fields.push('related_service_ids = ?'); values.push(data.relatedServiceIds ? JSON.stringify(data.relatedServiceIds) : null); }
    if (data.seoTitle !== undefined) { fields.push('seo_title = ?'); values.push(data.seoTitle); }
    if (data.metaDescription !== undefined) { fields.push('meta_description = ?'); values.push(data.metaDescription); }
    if (data.h1Heading !== undefined) { fields.push('h1_heading = ?'); values.push(data.h1Heading); }
    if (data.primaryCtaText !== undefined) { fields.push('primary_cta_text = ?'); values.push(data.primaryCtaText); }
    if (data.primaryCtaLink !== undefined) { fields.push('primary_cta_link = ?'); values.push(data.primaryCtaLink); }
    if (data.ctaType !== undefined) { fields.push('cta_type = ?'); values.push(data.ctaType); }
    if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
    if (data.billingPeriod !== undefined) { fields.push('billing_period = ?'); values.push(data.billingPeriod); }
    if (data.pricingMode !== undefined) { fields.push('pricing_mode = ?'); values.push(data.pricingMode); }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    if (data.isFeatured !== undefined) { fields.push('is_featured = ?'); values.push(data.isFeatured ? 1 : 0); }
    if (data.displayOrder !== undefined) { fields.push('display_order = ?'); values.push(data.displayOrder); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Sync child entities if provided
    if (data.faqs !== undefined) {
      await this.syncServiceFaqs(id, data.faqs || []);
    }
    if (data.documentsList !== undefined) {
      await this.syncServiceDocuments(id, data.documentsList || []);
    }
    if (data.processStepsList !== undefined) {
      await this.syncServiceProcessSteps(id, data.processStepsList || []);
    }
    if (data.relatedServiceIds !== undefined) {
      await this.syncRelatedServices(id, data.relatedServiceIds || []);
    }
  }

  static async recordPriceHistory(data: {
    serviceId: number;
    previousBasePrice: number | null;
    newBasePrice: number | null;
    previousDiscountPrice: number | null;
    newDiscountPrice: number | null;
    currency: string;
    changedBy?: number;
    reason?: string | null;
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO service_price_history (
        service_id, previous_base_price, new_base_price,
        previous_discount_price, new_discount_price,
        currency, changed_by, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.serviceId,
        data.previousBasePrice,
        data.newBasePrice,
        data.previousDiscountPrice,
        data.newDiscountPrice,
        data.currency,
        data.changedBy || null,
        data.reason || null,
      ]
    );
    return result.insertId;
  }

  static async listPriceHistory(serviceId: number): Promise<ServicePriceHistoryRecord[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        sph.*,
        CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
       FROM service_price_history sph
       LEFT JOIN users u ON u.id = sph.changed_by
       WHERE sph.service_id = ?
       ORDER BY sph.created_at DESC`,
      [serviceId]
    );
    return rows as ServicePriceHistoryRecord[];
  }

  static async deleteService(id: number): Promise<void> {
    await pool.query(
      `UPDATE services SET deleted_at = CURRENT_TIMESTAMP, is_active = 0 WHERE id = ?`,
      [id]
    );
  }
}
