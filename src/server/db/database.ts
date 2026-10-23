import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

export const databaseEnabled = Boolean(process.env.DATABASE_URL);
export const pool = databaseEnabled
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

pool?.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export function getPool(): Pool {
  if (!pool) {
    throw new Error('DATABASE_URL is required for PostgreSQL-backed routes.');
  }
  return pool;
}