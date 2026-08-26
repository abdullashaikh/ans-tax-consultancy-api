import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  APP_NAME: z.string().default('ANS Tax Consultancy API'),
  API_VERSION: z.string().default('v1'),
  APP_URL: z.string().url().default('http://localhost:5000'),
  API_PREFIX: z.string().default('/api/v1'),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform((val) => val.split(',').map((origin) => origin.trim())),

  // Database
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.string().transform((val) => parseInt(val, 10)).default('3306'),
  DB_NAME: z.string().default('ans_tax_consultancy'),
  DB_USER: z.string().default('ans_api'),
  DB_PASSWORD: z.string().default(''),
  DB_CONNECTION_LIMIT: z.string().transform((val) => parseInt(val, 10)).default('20'),
  DB_WAIT_FOR_CONNECTIONS: z.string().transform((val) => val === 'true').default('true'),
  DB_QUEUE_LIMIT: z.string().transform((val) => parseInt(val, 10)).default('0'),
  DB_TIMEZONE: z.string().default('+00:00'),
  DB_SSL: z.string().transform((val) => val === 'true').default('false'),

  // JWT & Authentication
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long')
    .default('development_jwt_access_secret_key_minimum_32_characters_long_123'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long')
    .default('development_jwt_refresh_secret_key_minimum_32_characters_long_123'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // Cookies
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.string().transform((val) => val === 'true').default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECRET: z
    .string()
    .min(32, 'COOKIE_SECRET must be at least 32 characters long')
    .default('development_cookie_secret_key_minimum_32_characters_long_123456'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform((val) => parseInt(val, 10)).default('900000'), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.string().transform((val) => parseInt(val, 10)).default('300'),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.string().transform((val) => parseInt(val, 10)).default('10'),
  LEAD_RATE_LIMIT_MAX_REQUESTS: z.string().transform((val) => parseInt(val, 10)).default('15'),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  // Storage (AWS S3 / Cloud Storage)
  STORAGE_PROVIDER: z.string().default('S3'),
  STORAGE_BUCKET: z.string().default('ans-tax-private-documents'),
  STORAGE_REGION: z.string().default('ap-south-1'),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SIGNED_URL_EXPIRY_SECONDS: z.string().transform((val) => parseInt(val, 10)).default('900'),

  // Payment
  PAYMENT_PROVIDER: z.string().default('RAZORPAY'),
  PAYMENT_KEY_ID: z.string().optional(),
  PAYMENT_KEY_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

  // Email & Resend OTP Provider
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('"ANS Tax Consultancy" <onboarding@resend.dev>'),

  // OTP Configuration & Security
  OTP_EXPIRATION_SECONDS: z.string().transform((val) => parseInt(val, 10)).default('300'),
  OTP_MAX_ATTEMPTS: z.string().transform((val) => parseInt(val, 10)).default('5'),
  OTP_RESEND_COOLDOWN_SECONDS: z.string().transform((val) => parseInt(val, 10)).default('30'),
  OTP_MAX_RESENDS: z.string().transform((val) => parseInt(val, 10)).default('3'),
  OTP_REQUEST_RATE_LIMIT_WINDOW_MS: z.string().transform((val) => parseInt(val, 10)).default('900000'), // 15 mins
  OTP_REQUEST_RATE_LIMIT_MAX: z.string().transform((val) => parseInt(val, 10)).default('3'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    if (process.env['NODE_ENV'] === 'production') {
      process.exit(1);
    }
  }
  return result.success ? result.data : (envSchema.parse({}) as z.infer<typeof envSchema>);
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
