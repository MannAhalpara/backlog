import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let isInitialized = false;

async function initDatabase() {
  if (isInitialized) return;
  try {
    // 1. Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_hash VARCHAR(64) UNIQUE NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Double-check for column existence (in case an incompatible table existed before)
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' AND column_name = 'session_hash'
    `);

    if (checkRes.rowCount === 0) {
      console.warn('user_sessions table exists but lacks session_hash column. Recreating...');
      await pool.query('DROP TABLE IF EXISTS user_sessions CASCADE');
      await pool.query(`
        CREATE TABLE user_sessions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          session_hash VARCHAR(64) UNIQUE NOT NULL,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('user_sessions recreated successfully.');
    }

    isInitialized = true;
    console.log('Database tables verified/initialized.');
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
  }
}

export async function query(text: string, params?: any[]) {
  if (!isInitialized) {
    await initDatabase();
  }
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query:', { text: text.replace(/\s+/g, ' ').trim(), duration, rows: res.rowCount });
  return res;
}

export { pool };
