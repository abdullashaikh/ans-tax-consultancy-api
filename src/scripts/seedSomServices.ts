import { initDatabasePool, pool } from '../config/database';
import { SOM_CATEGORIES_105, ALL_SOM_105_SERVICES } from '../data/som105Data';

async function runSom105Migration() {
  console.log('================================================================');
  console.log('ANS TAX CONSULTANCY — PHASE 2: 105 SOM SERVICES MIGRATION');
  console.log('================================================================');

  try {
    initDatabasePool();

    // Verify DB Connection
    const [dbTest]: any = await pool.query('SELECT 1 AS ok');
    if (!dbTest || dbTest.length === 0) {
      throw new Error('Database connection failed.');
    }
    console.log('Database connected successfully.\n');

    // ------------------------------------------------------------------------
    // Step 0: Ensure Tables & Columns Exist Idempotently
    // ------------------------------------------------------------------------
    console.log('--- STEP 0: ENSURING SCHEMA & CHILD ENTITY TABLES ---');

    // Add som_number to services if missing
    try {
      const [somCol]: any = await pool.query("SHOW COLUMNS FROM services LIKE 'som_number'");
      if (somCol.length === 0) {
        await pool.query('ALTER TABLE services ADD COLUMN som_number INT UNSIGNED NULL DEFAULT NULL AFTER id');
      }
    } catch (e: any) {
      console.warn('Warning adding som_number column:', e.message);
    }

    // Add cta_type to services if missing
    try {
      const [ctaCol]: any = await pool.query("SHOW COLUMNS FROM services LIKE 'cta_type'");
      if (ctaCol.length === 0) {
        await pool.query("ALTER TABLE services ADD COLUMN cta_type VARCHAR(50) NOT NULL DEFAULT 'CONSULTATION'");
      }
    } catch (e: any) {
      console.warn('Warning adding cta_type column:', e.message);
    }

    // Make base_price nullable for custom quote services
    try {
      await pool.query('ALTER TABLE services MODIFY COLUMN base_price DECIMAL(14,2) NULL DEFAULT NULL');
    } catch (e: any) {
      console.warn('Warning modifying base_price column:', e.message);
    }

    // Fix index uniqueness: allow identical slugs across different regions (e.g. INDIA vs UAE)
    try {
      await pool.query('ALTER TABLE services DROP INDEX uq_services_slug');
    } catch { /* ignore */ }
    try {
      await pool.query('ALTER TABLE services DROP INDEX slug');
    } catch { /* ignore */ }
    try {
      await pool.query('ALTER TABLE services ADD UNIQUE KEY uq_services_region_slug (region, slug)');
    } catch { /* ignore */ }

    // Ensure service_faqs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_faqs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        service_id BIGINT UNSIGNED NOT NULL,
        question VARCHAR(500) NOT NULL,
        answer TEXT NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_svc_faqs_svc_id (service_id, is_active, display_order),
        CONSTRAINT fk_svc_faqs_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure service_documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_documents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        service_id BIGINT UNSIGNED NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        description TEXT NULL DEFAULT NULL,
        is_required TINYINT(1) NOT NULL DEFAULT 1,
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_svc_docs_svc_id (service_id, display_order),
        CONSTRAINT fk_svc_docs_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure service_process_steps table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_process_steps (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        service_id BIGINT UNSIGNED NOT NULL,
        step_number INT NOT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_svc_steps_svc_id (service_id, step_number),
        CONSTRAINT fk_svc_steps_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure service_related_services table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_related_services (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        service_id BIGINT UNSIGNED NOT NULL,
        related_service_id BIGINT UNSIGNED NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_svc_related_pair (service_id, related_service_id),
        KEY idx_svc_related_target (related_service_id),
        CONSTRAINT fk_svc_related_source FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_svc_related_target FOREIGN KEY (related_service_id) REFERENCES services (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('Schema verification complete.\n');

    // ------------------------------------------------------------------------
    // Step 1: Upsert SOM Categories
    // ------------------------------------------------------------------------
    console.log('--- STEP 1: UPSERTING SOM CATEGORIES ---');
    const categoryIdMap: Record<string, number> = {};

    for (const catDef of SOM_CATEGORIES_105) {
      const [existing]: any = await pool.query(
        'SELECT id, name, slug, region FROM service_categories WHERE slug = ? LIMIT 1',
        [catDef.slug]
      );

      if (existing.length > 0) {
        const catId = existing[0].id;
        categoryIdMap[catDef.slug] = catId;
        await pool.query(
          `UPDATE service_categories
           SET name = ?, region = ?, description = ?, icon = ?, display_order = ?, is_active = 1, deleted_at = NULL
           WHERE id = ?`,
          [catDef.name, catDef.region, catDef.description, catDef.icon, catDef.displayOrder, catId]
        );
        console.log(`  [UPDATE CAT] "${catDef.name}" (${catDef.slug}) -> ID ${catId}`);
      } else {
        const [insertRes]: any = await pool.query(
          `INSERT INTO service_categories (name, slug, region, description, icon, display_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [catDef.name, catDef.slug, catDef.region, catDef.description, catDef.icon, catDef.displayOrder]
        );
        const newCatId = insertRes.insertId;
        categoryIdMap[catDef.slug] = newCatId;
        console.log(`  [CREATE CAT] "${catDef.name}" (${catDef.slug}) -> ID ${newCatId}`);
      }
    }

    // ------------------------------------------------------------------------
    // Step 2: Seed / Update 105 Services
    // ------------------------------------------------------------------------
    console.log('\n--- STEP 2: RECONCILING & SEEDING 105 SOM SERVICES ---');

    const [existingServices]: any = await pool.query(
      'SELECT id, som_number, name, slug, region, category_id, base_price, currency FROM services WHERE deleted_at IS NULL'
    );

    const existingServiceMap: Record<string, any> = {};
    for (const svc of existingServices) {
      const keyByRegionSlug = `${(svc.region || 'INDIA').toUpperCase()}::${svc.slug.toLowerCase()}`;
      existingServiceMap[keyByRegionSlug] = svc;
      if (svc.som_number) {
        existingServiceMap[`SOM::${svc.som_number}`] = svc;
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let keptCount = 0;

    const somNumberToDbIdMap: Record<number, number> = {};

    for (const somSvc of ALL_SOM_105_SERVICES) {
      const catId = categoryIdMap[somSvc.categorySlug] || 1;
      const keyByRegionSlug = `${somSvc.region.toUpperCase()}::${somSvc.slug.toLowerCase()}`;
      const existing = existingServiceMap[`SOM::${somSvc.somNumber}`] || existingServiceMap[keyByRegionSlug];

      let serviceId: number;

      if (existing) {
        serviceId = existing.id;
        somNumberToDbIdMap[somSvc.somNumber] = serviceId;

        await pool.query(
          `UPDATE services SET
            som_number = ?,
            category_id = ?,
            name = ?,
            slug = ?,
            region = ?,
            short_description = ?,
            description = ?,
            overview = ?,
            eligibility = ?,
            turnaround = ?,
            processing_time = ?,
            base_price = ?,
            discount_price = ?,
            promo_price = ?,
            pricing_notes = ?,
            currency = ?,
            billing_period = ?,
            pricing_mode = ?,
            exclusions = ?,
            required_documents = ?,
            deliverables = ?,
            process_steps = ?,
            seo_title = ?,
            meta_description = ?,
            h1_heading = ?,
            primary_cta_text = ?,
            primary_cta_link = ?,
            cta_type = ?,
            is_featured = ?,
            display_order = ?,
            is_active = 1,
            deleted_at = NULL
          WHERE id = ?`,
          [
            somSvc.somNumber,
            catId,
            somSvc.name,
            somSvc.slug,
            somSvc.region,
            somSvc.shortDescription,
            somSvc.description,
            somSvc.overview,
            somSvc.eligibility,
            somSvc.turnaround,
            somSvc.turnaround,
            somSvc.basePrice,
            somSvc.promoPrice || null,
            somSvc.promoPrice || null,
            somSvc.pricingNotes || null,
            somSvc.currency,
            somSvc.billingPeriod,
            somSvc.pricingMode,
            somSvc.exclusions ? JSON.stringify(somSvc.exclusions) : null,
            JSON.stringify(somSvc.requiredDocuments),
            JSON.stringify(somSvc.deliverables),
            JSON.stringify(somSvc.processSteps),
            somSvc.seoTitle,
            somSvc.metaDescription,
            somSvc.h1Heading,
            somSvc.primaryCtaText || 'Book Consultation',
            somSvc.primaryCtaLink || null,
            somSvc.ctaType || 'CONSULTATION',
            somSvc.isFeatured ? 1 : 0,
            somSvc.displayOrder,
            serviceId,
          ]
        );

        updatedCount++;
        console.log(`  [UPDATE] SOM #${somSvc.somNumber} "${somSvc.name}" (${somSvc.region}/${somSvc.slug}) -> ID ${serviceId}`);
      } else {
        const [insertRes]: any = await pool.query(
          `INSERT INTO services (
            som_number, category_id, name, slug, region, short_description, description,
            overview, eligibility, turnaround, processing_time, base_price, discount_price, promo_price,
            pricing_notes, currency, billing_period, pricing_mode, exclusions,
            required_documents, deliverables, process_steps,
            seo_title, meta_description, h1_heading, primary_cta_text, primary_cta_link, cta_type,
            is_featured, display_order, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            somSvc.somNumber,
            catId,
            somSvc.name,
            somSvc.slug,
            somSvc.region,
            somSvc.shortDescription,
            somSvc.description,
            somSvc.overview,
            somSvc.eligibility,
            somSvc.turnaround,
            somSvc.turnaround,
            somSvc.basePrice,
            somSvc.promoPrice || null,
            somSvc.promoPrice || null,
            somSvc.pricingNotes || null,
            somSvc.currency,
            somSvc.billingPeriod,
            somSvc.pricingMode,
            somSvc.exclusions ? JSON.stringify(somSvc.exclusions) : null,
            JSON.stringify(somSvc.requiredDocuments),
            JSON.stringify(somSvc.deliverables),
            JSON.stringify(somSvc.processSteps),
            somSvc.seoTitle,
            somSvc.metaDescription,
            somSvc.h1Heading,
            somSvc.primaryCtaText || 'Book Consultation',
            somSvc.primaryCtaLink || null,
            somSvc.ctaType || 'CONSULTATION',
            somSvc.isFeatured ? 1 : 0,
            somSvc.displayOrder,
          ]
        );

        serviceId = insertRes.insertId;
        somNumberToDbIdMap[somSvc.somNumber] = serviceId;

        if (somSvc.basePrice !== null) {
          await pool.query(
            `INSERT INTO service_price_history (
              service_id, previous_base_price, new_base_price,
              previous_discount_price, new_discount_price, currency,
              reason
            ) VALUES (?, NULL, ?, NULL, ?, ?, 'SOM 105 Master Catalogue Initial Seed')`,
            [serviceId, somSvc.basePrice, somSvc.promoPrice || null, somSvc.currency]
          );
        }

        createdCount++;
        console.log(`  [CREATE] SOM #${somSvc.somNumber} "${somSvc.name}" (${somSvc.region}/${somSvc.slug}) -> ID ${serviceId}`);
      }

      // ----------------------------------------------------------------------
      // Step 3: Populate Normalized Child Tables
      // ----------------------------------------------------------------------
      // A. Documents
      await pool.query('DELETE FROM service_documents WHERE service_id = ?', [serviceId]);
      if (Array.isArray(somSvc.requiredDocuments)) {
        for (let i = 0; i < somSvc.requiredDocuments.length; i++) {
          const doc = somSvc.requiredDocuments[i];
          if (!doc) continue;
          const docName = typeof doc === 'string' ? doc : doc.name;
          const docDesc = typeof doc === 'string' ? null : (doc.description || null);
          const isReq = typeof doc === 'string' ? 1 : (doc.isRequired !== false ? 1 : 0);
          await pool.query(
            'INSERT INTO service_documents (service_id, document_name, description, is_required, display_order) VALUES (?, ?, ?, ?, ?)',
            [serviceId, docName, docDesc, isReq, i + 1]
          );
        }
      }

      // B. Process Steps
      await pool.query('DELETE FROM service_process_steps WHERE service_id = ?', [serviceId]);
      if (Array.isArray(somSvc.processSteps)) {
        for (const step of somSvc.processSteps) {
          await pool.query(
            'INSERT INTO service_process_steps (service_id, step_number, title, description) VALUES (?, ?, ?, ?)',
            [serviceId, step.step, step.title, step.description]
          );
        }
      }

      // C. FAQs
      if (Array.isArray(somSvc.faqs) && somSvc.faqs.length > 0) {
        await pool.query('DELETE FROM service_faqs WHERE service_id = ?', [serviceId]);
        for (let i = 0; i < somSvc.faqs.length; i++) {
          const f = somSvc.faqs[i]!;
          await pool.query(
            'INSERT INTO service_faqs (service_id, question, answer, display_order, is_active) VALUES (?, ?, ?, ?, 1)',
            [serviceId, f.question, f.answer, f.displayOrder || i + 1]
          );
        }
      }
    }

    // ------------------------------------------------------------------------
    // Step 4: Link Related Services
    // ------------------------------------------------------------------------
    console.log('\n--- STEP 4: LINKING RELATED SERVICE ASSOCIATIONS ---');
    for (const somSvc of ALL_SOM_105_SERVICES) {
      const parentId = somNumberToDbIdMap[somSvc.somNumber];
      if (!parentId || !somSvc.relatedServiceSomNumbers) continue;

      await pool.query('DELETE FROM service_related_services WHERE service_id = ?', [parentId]);
      const relatedIds: number[] = [];

      for (let i = 0; i < somSvc.relatedServiceSomNumbers.length; i++) {
        const targetSomNum = somSvc.relatedServiceSomNumbers[i]!;
        const targetId = somNumberToDbIdMap[targetSomNum];
        if (targetId && targetId !== parentId && !relatedIds.includes(targetId)) {
          relatedIds.push(targetId);
          await pool.query(
            'INSERT IGNORE INTO service_related_services (service_id, related_service_id, display_order) VALUES (?, ?, ?)',
            [parentId, targetId, i + 1]
          );
        }
      }

      // Also update JSON cache
      await pool.query('UPDATE services SET related_service_ids = ? WHERE id = ?', [
        JSON.stringify(relatedIds),
        parentId,
      ]);
    }

    // Check for custom existing services not in SOM 105 list
    const somKeys = new Set(ALL_SOM_105_SERVICES.map((s) => `${s.region.toUpperCase()}::${s.slug.toLowerCase()}`));
    for (const svc of existingServices) {
      const key = `${(svc.region || 'INDIA').toUpperCase()}::${svc.slug.toLowerCase()}`;
      if (!somKeys.has(key) && (!svc.som_number || svc.som_number > 105)) {
        keptCount++;
        console.log(`  [KEEP] Existing database service ID ${svc.id} "${svc.name}" preserved.`);
      }
    }

    // ------------------------------------------------------------------------
    // Final Migration Summary
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('PHASE 2 MIGRATION SUMMARY & AUDIT REPORT');
    console.log('================================================================');
    console.log(`Total Categories Processed   : ${SOM_CATEGORIES_105.length}`);
    console.log(`Total SOM Services Processed : ${ALL_SOM_105_SERVICES.length} (Target: 105)`);
    console.log(`  - Services Created (NEW)      : ${createdCount}`);
    console.log(`  - Services Updated (ENRICHED) : ${updatedCount}`);
    console.log(`  - Custom Services Kept (SAFE) : ${keptCount}`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runSom105Migration();
}
