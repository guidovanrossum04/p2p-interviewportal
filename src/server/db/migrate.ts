import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './database';

const pool = getPool();
const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

try {
  await pool.query(await readFile(schemaPath, 'utf8'));
  console.log('Database schema is ready.');
} finally {
  await pool.end();
}