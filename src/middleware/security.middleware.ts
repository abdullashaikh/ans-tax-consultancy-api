import { Request, Response, NextFunction } from 'express';

/**
 * Ensures sensitive user, financial, and application data is never cached by browsers or proxy CDNs.
 */
export const noCacheMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};
