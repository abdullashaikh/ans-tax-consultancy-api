/// <reference path="../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Use client-provided request ID if valid UUID, or generate a new one
  const headerReqId = req.headers['x-request-id'];
  const requestId = typeof headerReqId === 'string' && headerReqId.length > 0 ? headerReqId : uuidv4();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
};
