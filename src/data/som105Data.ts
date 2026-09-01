import { SOM_SERVICES_105 } from './somServicesList';
import { SOM_SERVICES_PART_2 } from './somServicesListPart2';

export interface SomCategoryData {
  name: string;
  slug: string;
  region: 'INDIA' | 'UAE' | 'GLOBAL';
  description: string;
  icon: string;
  displayOrder: number;
}

export interface SomServiceData {
  somNumber: number;
  categorySlug: string;
  name: string;
  slug: string;
  region: 'INDIA' | 'UAE';
  shortDescription: string;
  description: string;
  overview: string;
  eligibility: string;
  turnaround: string;
  basePrice: number | null;
  promoPrice?: number | null;
  currency: 'INR' | 'AED';
  billingPeriod: string;
  pricingMode: 'FIXED' | 'STARTING_FROM' | 'CUSTOM_QUOTE';
  pricingNotes?: string;
  exclusions?: string[];
  requiredDocuments: Array<{ name: string; description?: string; isRequired?: boolean }> | string[];
  deliverables: string[];
  processSteps: Array<{ step: number; title: string; description: string }>;
  seoTitle: string;
  metaDescription: string;
  h1Heading: string;
  primaryCtaText?: string;
  primaryCtaLink?: string;
  ctaType?: string;
  isFeatured?: boolean;
  displayOrder: number;
  faqs?: Array<{ question: string; answer: string; displayOrder?: number }>;
  relatedServiceSomNumbers?: number[];
}

export const SOM_CATEGORIES_105: SomCategoryData[] = [
  // India Categories
  { name: 'GST', slug: 'gst', region: 'INDIA', description: 'Goods and Services Tax registrations, returns, refunds, and departmental notices', icon: 'file-check', displayOrder: 1 },
  { name: 'Income Tax', slug: 'income-tax', region: 'INDIA', description: 'Individual, salaried, capital gains, business ITR, and NRI taxation', icon: 'receipt', displayOrder: 2 },
  { name: 'Registration', slug: 'registration', region: 'INDIA', description: 'Private Limited, LLP, OPC, Section 8, MSME, and startup business incorporation', icon: 'building-2', displayOrder: 3 },
  { name: 'Trademark', slug: 'trademark', region: 'INDIA', description: 'Brand trademark registration, search, renewals, and objection replies', icon: 'award', displayOrder: 4 },
  { name: 'Licence', slug: 'licence', region: 'INDIA', description: 'FSSAI food license, Import Export Code (IEC), and Shop & Establishment', icon: 'clipboard-check', displayOrder: 5 },
  { name: 'Notice', slug: 'notice', region: 'INDIA', description: 'Legal representation for Income Tax, GST, TDS, and ROC statutory notices', icon: 'alert-triangle', displayOrder: 6 },
  { name: 'Accounting', slug: 'accounting', region: 'INDIA', description: 'Monthly bookkeeping, reconciliation, financial statements, and MIS reporting', icon: 'calculator', displayOrder: 7 },
  { name: 'TDS', slug: 'tds', region: 'INDIA', description: 'TAN registration, quarterly returns (24Q/26Q), and lower deduction certificates', icon: 'percent', displayOrder: 8 },
  { name: 'ROC', slug: 'roc', region: 'INDIA', description: 'Annual MCA filings, Director KYC (DIR-3), DIN, and company secretarial compliance', icon: 'shield-check', displayOrder: 9 },
  { name: 'Payroll', slug: 'payroll', region: 'INDIA', description: 'Employee payroll, salary slips, PF, ESIC, and Professional Tax compliance', icon: 'users', displayOrder: 10 },
  { name: 'E-Commerce', slug: 'ecommerce', region: 'INDIA', description: 'Amazon, Flipkart, Meesho, and Shopify multi-state GST and marketplace accounting', icon: 'shopping-cart', displayOrder: 11 },
  { name: 'Audit', slug: 'audit', region: 'INDIA', description: 'Tax audit u/s 44AB, statutory audit support, and GST audit readiness', icon: 'check-square', displayOrder: 12 },
  { name: 'IP', slug: 'ip', region: 'INDIA', description: 'Copyright registration, intellectual property protection, and design patents', icon: 'shield', displayOrder: 13 },
  { name: 'Legal', slug: 'legal', region: 'INDIA', description: 'Commercial business agreements, vendor contracts, and NDA drafting', icon: 'file-text', displayOrder: 14 },
  { name: 'Advisory', slug: 'advisory', region: 'INDIA', description: 'Virtual CFO, strategic tax planning, and business compliance health checks', icon: 'trending-up', displayOrder: 15 },
  { name: 'NGO', slug: 'ngo', region: 'INDIA', description: 'Trust & Society registration, Section 8, 12A & 80G tax exemption certificates', icon: 'heart-handshake', displayOrder: 16 },

  // UAE Categories
  { name: 'UAE Tax', slug: 'uae-tax', region: 'UAE', description: 'UAE Corporate Tax 9% registration, return filing, QFZP 0% relief, and health checks', icon: 'building', displayOrder: 21 },
  { name: 'UAE VAT', slug: 'uae-vat', region: 'UAE', description: 'UAE 5% VAT registration, quarterly VAT 201 filing, and deregistration', icon: 'file-text', displayOrder: 22 },
  { name: 'UAE Accounting', slug: 'uae-accounting', region: 'UAE', description: 'IFRS bookkeeping, cloud accounting setup, and monthly management reporting', icon: 'calculator', displayOrder: 23 },
  { name: 'UAE Setup', slug: 'uae-setup', region: 'UAE', description: 'Dubai Mainland and Free Zone company formation and trade licensing', icon: 'briefcase', displayOrder: 24 },
  { name: 'UAE Compliance', slug: 'uae-compliance', region: 'UAE', description: 'Economic Substance Regulations (ESR), UBO filing, and AML compliance', icon: 'shield', displayOrder: 25 },
  { name: 'UAE Payroll', slug: 'uae-payroll', region: 'UAE', description: 'Wages Protection System (WPS) processing and gratuity (EOSG) calculations', icon: 'users', displayOrder: 26 },
  { name: 'UAE Audit', slug: 'uae-audit', region: 'UAE', description: 'Statutory financial audits for Free Zone renewals and FTA audit representation', icon: 'check-square', displayOrder: 27 },
];

export const ALL_SOM_105_SERVICES: SomServiceData[] = [
  ...SOM_SERVICES_105,
  ...SOM_SERVICES_PART_2,
];
