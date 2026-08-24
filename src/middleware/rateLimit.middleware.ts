import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
      )
    );
  },
});

export const leadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.LEAD_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many inquiry submissions from this IP. Please wait before submitting another query.'
      )
    );
  },
});

export const generalApiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests('API rate limit exceeded. Please throttle your requests.'));
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests('Document upload rate limit reached. Please wait a few moments.'));
  },
});
