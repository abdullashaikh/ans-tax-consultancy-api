import winston from 'winston';
import { env } from './env';

const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'jwt',
  'secret',
  'cvv',
  'cardNumber',
  'otp',
  'apiKey',
  'pan_reference',
  'gstin',
];

const redactObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = redactObject(obj[i]);
    }
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );

    if (isSensitive) {
      obj[key] = '[REDACTED]';
    } else if (obj[key] && typeof obj[key] === 'object') {
      obj[key] = redactObject(obj[key]);
    }
  }
  return obj;
};

// Winston format must mutate and return the original `info` to preserve Symbol properties like Symbol.for('level')
const sensitiveMaskFormat = winston.format((info) => {
  redactObject(info);
  return info;
})();

const formats = [
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  sensitiveMaskFormat,
  winston.format.errors({ stack: true }),
];

if (env.NODE_ENV === 'development') {
  formats.push(
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, requestId, stack, ...meta }) => {
      const reqId = requestId ? ` [${requestId}]` : '';
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      const errorStack = stack ? `\n${stack}` : '';
      return `${timestamp} [${level}]${reqId}: ${message}${metaStr}${errorStack}`;
    })
  );
} else {
  formats.push(winston.format.json());
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(...formats),
  defaultMeta: { service: 'ans-tax-backend' },
  transports: [
    new winston.transports.Console({
      silent: env.NODE_ENV === 'test',
    }),
  ],
  exitOnError: false,
});
