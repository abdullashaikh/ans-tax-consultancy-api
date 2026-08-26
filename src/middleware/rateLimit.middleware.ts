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

export const otpRequestRateLimiter = rateLimit({
  windowMs: env.OTP_REQUEST_RATE_LIMIT_WINDOW_MS,
  max: env.OTP_REQUEST_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env['NODE_ENV'] === 'test',
  handler: (_req, _res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many OTP requests from this IP address. Please wait 15 minutes before requesting another code.'
      )
    );
  },
});

export const otpVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env['NODE_ENV'] === 'test',
  handler: (_req, _res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many OTP verification attempts from this IP address. Please wait before trying again.'
      )
    );
  },
});

export const otpResendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env['NODE_ENV'] === 'test',
  handler: (_req, _res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many OTP resend requests from this IP address. Please wait before requesting another code.'
      )
    );
  },
});
