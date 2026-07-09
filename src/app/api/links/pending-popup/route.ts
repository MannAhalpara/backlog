import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find links where clicked_at IS NOT NULL and status = 'pending'
    const res = await query(
      `SELECT l.*, c.name as category_name 
       FROM links l
       LEFT JOIN categories c ON l.category_id = c.id
       WHERE l.user_id = $1 
         AND l.status = 'pending' 
         AND l.clicked_at IS NOT NULL 
       ORDER BY l.clicked_at ASC`,
      [user.userId]
    );

    return NextResponse.json({ links: res.rows });
  } catch (error) {
    console.error('Error fetching pending popup links:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
