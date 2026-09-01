import fs from 'fs';
import path from 'path';
import { ALL_SOM_105_SERVICES, SOM_CATEGORIES_105 } from '../data/som105Data';

const catMap = Object.fromEntries(SOM_CATEGORIES_105.map((c) => [c.slug, c.name]));

const categoriesJson = JSON.stringify(
  SOM_CATEGORIES_105.map((c, i) => ({
    id: i + 1,
    name: c.name,
    slug: c.slug,
    region: c.region,
    description: c.description,
    icon: c.icon,
    displayOrder: c.displayOrder,
    serviceCount: ALL_SOM_105_SERVICES.filter((s) => s.categorySlug === c.slug).length,
  })),
  null,
  2
);

const servicesJson = JSON.stringify(
  ALL_SOM_105_SERVICES.map((s) => ({
    id: s.somNumber,
    som_number: s.somNumber,
    category_id: SOM_CATEGORIES_105.findIndex((c) => c.slug === s.categorySlug) + 1,
    category_name: catMap[s.categorySlug] || s.categorySlug,
    category_slug: s.categorySlug,
    name: s.name,
    slug: s.slug,
    region: s.region,
    icon: s.region === 'UAE' ? 'Building' : 'Receipt',
    short_description: s.shortDescription,
    description: s.description,
    turnaround: s.turnaround,
    base_price: s.basePrice !== null ? String(s.basePrice) : null,
    discount_price: s.promoPrice ? String(s.promoPrice) : null,
    promo_price: s.promoPrice ? String(s.promoPrice) : null,
    currency: s.currency,
    billing_period: s.billingPeriod,
    pricing_mode: s.pricingMode,
    pricing_notes: s.pricingNotes || null,
    is_active: true,
    is_featured: Boolean(s.isFeatured),
    display_order: s.displayOrder,
  })),
  null,
  2
);

const tsContent = `import { PublicServiceCategory, PublicServiceListItem } from '../types';

export const FALLBACK_105_CATEGORIES: PublicServiceCategory[] = ${categoriesJson};

export const FALLBACK_105_SERVICES: PublicServiceListItem[] = ${servicesJson};
`;

const targetPath = path.resolve('../Frontend/src/data/som105CatalogueFallback.ts');
fs.writeFileSync(targetPath, tsContent, 'utf-8');
console.log('Successfully generated Frontend/src/data/som105CatalogueFallback.ts with 105 services!');
