import { cookies } from 'next/headers';
import crypto from 'crypto';
import { query } from './db';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60); // 60 days

  await query(
    'INSERT INTO user_sessions (session_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hash, userId, expiresAt]
  );

  return token;
}

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;

    const hash = hashToken(token);
    const res = await query(
      `SELECT u.id, u.email 
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_hash = $1 AND s.expires_at > NOW()`,
      [hash]
    );

    if (!res || res.rowCount === 0) return null;
    return {
      userId: res.rows[0].id as string,
      email: res.rows[0].email as string,
    };
  } catch (err) {
    console.error('Error getting session user:', err);
    return null;
  }
}

export async function deleteSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
      const hash = hashToken(token);
      await query('DELETE FROM user_sessions WHERE session_hash = $1', [hash]);
    }
  } catch (err) {
    console.error('Error deleting session from DB:', err);
  }
}
