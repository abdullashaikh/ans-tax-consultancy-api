/// <reference path="./types/express.d.ts" />
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { corsOptions, helmetOptions } from './config/security';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { generalApiRateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler } from './middleware/error.middleware';
import healthRoutes from './routes/health.routes';
import sitemapRoutes from './routes/sitemap.routes';
import v1Routes from './routes/v1';
import openApiSpec from './docs/openapi.json';
import { ApiError } from './utils/apiError';
import { ErrorCodes } from './constants/errorCodes';

export const createApp = (): Express => {
  const app = express();

  // Trust proxy for rate limiting / secure cookies behind reverse proxies (Nginx/Cloudflare)
  app.set('trust proxy', 1);

  // 1. Security Headers & CORS
  app.use(helmet(helmetOptions));
  app.use(cors(corsOptions));

  // 2. Request Correlation ID
  app.use(requestIdMiddleware);

  // 3. Body Parsing & Cookies
  app.use(
    express.json({
      limit: '1mb',
      verify: (req: any, _res, buf) => {
        // Save raw body for webhook HMAC signature verification
        req.rawBody = buf.toString();
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // 4. Interactive API Documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // 5. Health & Readiness probes (exempt from general rate limits)
  app.use(healthRoutes);

  // 6. Technical SEO & Dynamic Sitemaps (/robots.txt, /sitemap.xml, /service-sitemap.xml)
  app.use(sitemapRoutes);

  // 7. Rate Limiting for API routes
  app.use(env.API_PREFIX, generalApiRateLimiter);

  // 8. Mount V1 API Routes (/api/v1/...)
  app.use(env.API_PREFIX, v1Routes);

  // 8. 404 Catch-All Handler
  app.use((req: Request, _res: Response, next) => {
    next(
      ApiError.notFound(
        `Route ${req.method} ${req.originalUrl} not found on this server`,
        ErrorCodes.NOT_FOUND
      )
    );
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
};
