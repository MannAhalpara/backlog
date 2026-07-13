import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      `SELECT 
        c.id, 
        c.name, 
        c.created_at,
        COUNT(l.id)::int as total_count,
        COUNT(CASE WHEN l.status = 'pending' THEN 1 END)::int as pending_count
      FROM categories c
      LEFT JOIN links l ON c.id = l.category_id
      WHERE c.user_id = $1
      GROUP BY c.id, c.name, c.created_at
      ORDER BY c.name ASC`,
      [user.userId]
    );

    return NextResponse.json({ categories: res.rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
