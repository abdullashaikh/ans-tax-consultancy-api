import { initDatabasePool, pool } from '../config/database';

async function inspectDb() {
  try {
    initDatabasePool();
    const [tables]: any = await pool.query('SHOW TABLES');
    console.log('--- TABLES COUNT ---', tables.length);

    const [servicesDesc]: any = await pool.query('DESCRIBE services');
    console.log('--- SERVICES SCHEMA ---');
    console.table(servicesDesc.map((c: any) => ({ Field: c.Field, Type: c.Type })));

    const [services]: any = await pool.query('SELECT * FROM services');
    console.log('--- SERVICES IN DB ---');
    console.table(services);

    const [categories]: any = await pool.query('SELECT * FROM service_categories');
    console.log('--- SERVICE CATEGORIES ---');
    console.table(categories);

    const [docTypes]: any = await pool.query('SELECT * FROM document_types');
    console.log('--- DOCUMENT TYPES ---');
    console.table(docTypes);

    const [appIndexes]: any = await pool.query('SHOW INDEX FROM applications');
    console.log('--- APPLICATION INDEXES ---');
    console.table(appIndexes.map((i: any) => ({ Key_name: i.Key_name, Column_name: i.Column_name })));

    process.exit(0);
  } catch (err) {
    console.error('Inspection failed:', err);
    process.exit(1);
  }
}

inspectDb();
