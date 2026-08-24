import mysql, {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

import { env } from './env';
import { logger } from './logger';

export let pool: Pool;

const getSslConfig = () => {
  if (!env.DB_SSL) {
    return undefined;
  }

  const caPath = path.resolve(process.cwd(), 'certs', 'ca.pem');
  if (fs.existsSync(caPath)) {
    return {
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: true,
    };
  }

  // Fallback to TLS without strict CA rejection for managed cloud databases (e.g. Aiven)
  return {
    rejectUnauthorized: false,
  };
};

export const initDatabasePool = (): Pool => {
  if (pool) return pool;

  pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,

    waitForConnections: env.DB_WAIT_FOR_CONNECTIONS,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    queueLimit: env.DB_QUEUE_LIMIT,
    timezone: env.DB_TIMEZONE,

    ssl: getSslConfig(),

    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,

    // Keep disabled.
    multipleStatements: false,
  });

  logger.info(
    `MySQL connection pool initialized for database: ${env.DB_NAME}`
  );

  return pool;
};

export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const currentPool = pool || initDatabasePool();

    const [rows] = await currentPool.query<RowDataPacket[]>(
      'SELECT 1 AS alive'
    );

    return rows.length > 0 && Number(rows[0]?.['alive']) === 1;
  } catch (error: any) {
    logger.error('Database health check failed', {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
    });

    return false;
  }
};

export const withTransaction = async <T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> => {
  const currentPool = pool || initDatabasePool();

  const connection = await currentPool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await callback(connection);

    await connection.commit();

    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Database rollback failed:', rollbackError);
    }

    logger.error('Transaction rolled back due to error:', error);

    throw error;
  } finally {
    connection.release();
  }
};

export {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
};