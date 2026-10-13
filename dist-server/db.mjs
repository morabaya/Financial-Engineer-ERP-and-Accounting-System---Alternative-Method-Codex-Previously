import { Pool } from 'pg';
const url = process.env.DATABASE_URL;
export const db = url ? new Pool({ connectionString: url, max: 10, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined }) : null;
export async function health() { if (!db)
    return { database: 'not-configured' }; const result = await db.query('select now() as now'); return { database: 'ok', now: result.rows[0].now }; }
