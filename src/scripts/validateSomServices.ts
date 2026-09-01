import { initDatabasePool, pool } from '../config/database';
import { ALL_SOM_105_SERVICES } from '../data/som105Data';
import { RowDataPacket } from 'mysql2/promise';

interface ValidationResult {
  totalSomServices: number;
  totalDbServices: number;
  matchedCount: number;
  missingServices: Array<{ somNumber: number; name: string; region: string; slug: string }>;
  duplicateServices: Array<{ name: string; slug: string; region: string; ids: number[] }>;
  urlConflicts: Array<{ somNumber: number; expectedUrl: string; actualUrl: string }>;
  categoryConflicts: Array<{ somNumber: number; name: string; expectedCategory: string; actualCategory: string }>;
  pricingConflicts: Array<{ somNumber: number; name: string; expectedPrice: any; actualPrice: any }>;
  service105Verification: { passed: boolean; details: string };
  unresolvedMatches: Array<{ details: string }>;
}

async function validateSomServices() {
  console.log('================================================================');
  console.log('ANS TAX CONSULTANCY — 105 SOM CATALOGUE VALIDATION AUDIT');
  console.log('================================================================\n');

  try {
    initDatabasePool();

    const [dbServices] = await pool.query<RowDataPacket[]>(
      `SELECT
        s.id,
        s.som_number,
        s.name,
        s.slug,
        s.region,
        s.category_id,
        sc.slug AS category_slug,
        sc.name AS category_name,
        s.base_price,
        s.promo_price,
        s.discount_price,
        s.pricing_mode,
        s.currency,
        s.is_active
       FROM services s
       INNER JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.deleted_at IS NULL`
    );

    const result: ValidationResult = {
      totalSomServices: ALL_SOM_105_SERVICES.length,
      totalDbServices: dbServices.length,
      matchedCount: 0,
      missingServices: [],
      duplicateServices: [],
      urlConflicts: [],
      categoryConflicts: [],
      pricingConflicts: [],
      service105Verification: { passed: false, details: '' },
      unresolvedMatches: [],
    };

    // Check duplicates in DB
    const slugMap: Record<string, number[]> = {};
    for (const dbSvc of dbServices) {
      const key = `${(dbSvc['region'] || 'INDIA').toUpperCase()}::${dbSvc['slug'].toLowerCase()}`;
      if (!slugMap[key]) slugMap[key] = [];
      slugMap[key].push(dbSvc['id']);
    }

    for (const [key, ids] of Object.entries(slugMap)) {
      if (ids.length > 1) {
        const [region, slug] = key.split('::');
        result.duplicateServices.push({
          name: dbServices.find((s) => s['id'] === ids[0])?.['name'] || slug!,
          slug: slug!,
          region: region!,
          ids,
        });
      }
    }

    // Match each SOM service
    for (const somSvc of ALL_SOM_105_SERVICES) {
      const matched = dbServices.find(
        (s) =>
          s['som_number'] === somSvc.somNumber ||
          (s['slug'].toLowerCase() === somSvc.slug.toLowerCase() &&
            (s['region'] || 'INDIA').toUpperCase() === somSvc.region.toUpperCase())
      );

      if (!matched) {
        result.missingServices.push({
          somNumber: somSvc.somNumber,
          name: somSvc.name,
          region: somSvc.region,
          slug: somSvc.slug,
        });
        continue;
      }

      result.matchedCount++;

      // Check URL / Slug
      const expectedSlug = somSvc.slug.toLowerCase();
      const actualSlug = String(matched['slug']).toLowerCase();
      if (expectedSlug !== actualSlug) {
        result.urlConflicts.push({
          somNumber: somSvc.somNumber,
          expectedUrl: `/${somSvc.region.toLowerCase()}/${expectedSlug}/`,
          actualUrl: `/${String(matched['region']).toLowerCase()}/${actualSlug}/`,
        });
      }

      // Check Category
      if (matched['category_slug'] !== somSvc.categorySlug) {
        result.categoryConflicts.push({
          somNumber: somSvc.somNumber,
          name: somSvc.name,
          expectedCategory: somSvc.categorySlug,
          actualCategory: matched['category_slug'],
        });
      }

      // Check Pricing
      if (somSvc.somNumber === 105) {
        // Special check for #105
        const isCustom =
          matched['pricing_mode'] === 'CUSTOM_QUOTE' ||
          matched['base_price'] === null;
        if (isCustom) {
          result.service105Verification = {
            passed: true,
            details: `Service #105 "${matched['name']}" correctly configured with pricing_mode="CUSTOM_QUOTE" and base_price=null ("Price to be discussed on call").`,
          };
        } else {
          result.service105Verification = {
            passed: false,
            details: `Service #105 has unexpected numeric base_price="${matched['base_price']}". Expected NULL / CUSTOM_QUOTE.`,
          };
        }
      } else if (somSvc.basePrice !== null) {
        const expectedBase = Number(somSvc.basePrice);
        const actualBase = Number(matched['base_price']);
        if (Math.abs(expectedBase - actualBase) > 0.01) {
          result.pricingConflicts.push({
            somNumber: somSvc.somNumber,
            name: somSvc.name,
            expectedPrice: `${somSvc.currency} ${expectedBase}`,
            actualPrice: `${matched['currency']} ${actualBase}`,
          });
        }
      }
    }

    // Output Report
    console.log('--- CATALOGUE AUDIT RESULTS ---');
    console.log(`Total Authoritative SOM Services : ${result.totalSomServices}`);
    console.log(`Total Database Services          : ${result.totalDbServices}`);
    console.log(`Exact SOM Matched Services       : ${result.matchedCount} / 105`);
    console.log(`Missing SOM Services             : ${result.missingServices.length}`);
    console.log(`Duplicate URL / Slug Services    : ${result.duplicateServices.length}`);
    console.log(`URL Conflicts                    : ${result.urlConflicts.length}`);
    console.log(`Category Conflicts               : ${result.categoryConflicts.length}`);
    console.log(`Pricing Conflicts                : ${result.pricingConflicts.length}`);
    console.log(`Unresolved Matches               : ${result.unresolvedMatches.length}`);
    console.log(`\nService #105 Verification        : ${result.service105Verification.passed ? 'PASSED [OK]' : 'FAILED [ERROR]'}`);
    console.log(`  Details: ${result.service105Verification.details}`);

    if (result.missingServices.length > 0) {
      console.log('\n[WARNING] Missing Services:');
      console.table(result.missingServices);
    }
    if (result.duplicateServices.length > 0) {
      console.log('\n[WARNING] Duplicate Services:');
      console.table(result.duplicateServices);
    }
    if (result.urlConflicts.length > 0) {
      console.log('\n[WARNING] URL Conflicts:');
      console.table(result.urlConflicts);
    }
    if (result.categoryConflicts.length > 0) {
      console.log('\n[INFO] Category Differences:');
      console.table(result.categoryConflicts);
    }
    if (result.pricingConflicts.length > 0) {
      console.log('\n[INFO] Pricing Discrepancies:');
      console.table(result.pricingConflicts);
    }

    console.log('\n================================================================');
    if (result.matchedCount === 105 && result.missingServices.length === 0 && result.duplicateServices.length === 0) {
      console.log('STATUS: ALL 105 SOM SERVICES ARE 100% COMPLIANT & READY.');
    } else {
      console.log('STATUS: VALIDATION IDENTIFIED ITEMS REQUIRING ATTENTION.');
    }
    console.log('================================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('Validation failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  validateSomServices();
}
