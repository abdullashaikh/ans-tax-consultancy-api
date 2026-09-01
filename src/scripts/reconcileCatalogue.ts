import { initDatabasePool, pool } from '../config/database';
import { SOM_CATEGORIES_105, ALL_SOM_105_SERVICES } from '../data/som105Data';

async function reconcile() {
  console.log('--- RECONCILING SOM 105 CATALOGUE ---');
  initDatabasePool();

  // 1. Upsert official SOM categories
  const categoryIdMap: Record<string, number> = {};
  const validCategorySlugs = SOM_CATEGORIES_105.map((c) => c.slug);

  for (const cat of SOM_CATEGORIES_105) {
    const [rows]: any = await pool.query('SELECT id FROM service_categories WHERE slug = ? LIMIT 1', [cat.slug]);
    if (rows.length > 0) {
      const catId = rows[0].id;
      categoryIdMap[cat.slug] = catId;
      await pool.query(
        `UPDATE service_categories
         SET name = ?, region = ?, description = ?, icon = ?, display_order = ?, is_active = 1, deleted_at = NULL
         WHERE id = ?`,
        [cat.name, cat.region, cat.description, cat.icon, cat.displayOrder, catId]
      );
    } else {
      const [res]: any = await pool.query(
        `INSERT INTO service_categories (name, slug, region, description, icon, display_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [cat.name, cat.slug, cat.region, cat.description, cat.icon, cat.displayOrder]
      );
      categoryIdMap[cat.slug] = res.insertId;
    }
  }

  // 2. Deactivate any legacy/duplicate categories not in SOM 105 list
  await pool.query(
    `UPDATE service_categories
     SET is_active = 0, deleted_at = NOW()
     WHERE slug NOT IN (${validCategorySlugs.map(() => '?').join(',')})`,
    validCategorySlugs
  );
  console.log(`Deactivated legacy categories not in SOM 105.`);

  // 3. Deactivate legacy services where som_number is null or > 105
  await pool.query(
    `UPDATE services
     SET is_active = 0, deleted_at = NOW()
     WHERE som_number IS NULL OR som_number > 105`
  );
  console.log(`Deactivated legacy services without SOM numbers.`);

  // 4. Ensure all 105 SOM services are active with correct category_id
  for (const svc of ALL_SOM_105_SERVICES) {
    const catId = categoryIdMap[svc.categorySlug] || 1;
    await pool.query(
      `UPDATE services
       SET category_id = ?, is_active = 1, deleted_at = NULL
       WHERE som_number = ?`,
      [catId, svc.somNumber]
    );
  }
  console.log(`Re-aligned all 105 SOM services to official categories.`);

  // 5. Final counts verification
  const [totalActive]: any = await pool.query(
    'SELECT count(*) as total FROM services WHERE is_active = 1 AND deleted_at IS NULL'
  );
  const [indiaActive]: any = await pool.query(
    "SELECT count(*) as total FROM services WHERE region = 'INDIA' AND is_active = 1 AND deleted_at IS NULL"
  );
  const [uaeActive]: any = await pool.query(
    "SELECT count(*) as total FROM services WHERE region = 'UAE' AND is_active = 1 AND deleted_at IS NULL"
  );

  console.log('--- RECONCILIATION RESULT ---');
  console.log(`Total Active Services : ${totalActive[0].total} (Target: 105)`);
  console.log(`India Active Services : ${indiaActive[0].total} (Target: 90)`);
  console.log(`UAE Active Services   : ${uaeActive[0].total} (Target: 15)`);

  process.exit(0);
}

reconcile().catch((err) => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
