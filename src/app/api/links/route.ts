import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

function getAppSource(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('medium.com')) return 'medium';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    return 'other';
  } catch (err) {
    // Fallback search if URL parsing fails
    const cleanStr = urlStr.toLowerCase();
    if (cleanStr.includes('linkedin.com')) return 'linkedin';
    if (cleanStr.includes('instagram.com')) return 'instagram';
    if (cleanStr.includes('medium.com')) return 'medium';
    if (cleanStr.includes('youtube.com') || cleanStr.includes('youtu.be')) return 'youtube';
    return 'other';
  }
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const app = searchParams.get('app');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'desc';
    const view = searchParams.get('view') || 'pending';

    const userId = user.userId;
    const params: any[] = [userId];
    let paramCount = 1;

    let sql = `
      SELECT l.*, c.name as category_name 
      FROM links l 
      LEFT JOIN categories c ON l.category_id = c.id 
      WHERE l.user_id = $1
    `;

    // Filter by view status
    if (view === 'history') {
      sql += ` AND l.status = 'done'`;
    } else {
      sql += ` AND l.status = 'pending'`;
    }

    // Filter by app source
    if (app && app !== 'all') {
      paramCount++;
      sql += ` AND l.app_source = $${paramCount}`;
      params.push(app);
    }

    // Filter by category
    if (category && category !== 'all') {
      if (category === 'null' || category === 'uncategorized') {
        sql += ` AND l.category_id IS NULL`;
      } else {
        paramCount++;
        sql += ` AND l.category_id = $${paramCount}`;
        params.push(category);
      }
    }

    // Search query
    if (search && search.trim() !== '') {
      paramCount++;
      sql += ` AND (l.note ILIKE $${paramCount} OR l.url ILIKE $${paramCount})`;
      params.push(`%${search.trim()}%`);
    }

    // Sort order
    const direction = sort === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY l.created_at ${direction}`;

    const res = await query(sql, params);

    // Also get distinct app sources for filters
    const sourcesRes = await query(
      'SELECT DISTINCT app_source FROM links WHERE user_id = $1 AND status != \'removed\' ORDER BY app_source',
      [userId]
    );
    const sources = sourcesRes.rows.map((row) => row.app_source);

    return NextResponse.json({
      links: res.rows,
      sources,
    });
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, note, categoryId, newCategoryName } = await request.json();

    if (!url || url.trim() === '') {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }

    const userId = user.userId;
    let finalCategoryId = categoryId || null;

    // Handle inline creation of new category
    if (newCategoryName && newCategoryName.trim() !== '') {
      const trimmedCatName = newCategoryName.trim();
      
      // Use ON CONFLICT to insert or select
      const catRes = await query(
        `INSERT INTO categories (user_id, name) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, name) 
         DO UPDATE SET name = EXCLUDED.name 
         RETURNING id`,
        [userId, trimmedCatName]
      );
      
      finalCategoryId = catRes.rows[0].id;
    }

    // Determine app source
    const appSource = getAppSource(url.trim());

    // Insert new link
    const res = await query(
      `INSERT INTO links (user_id, url, note, category_id, app_source, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
       RETURNING *`,
      [userId, url.trim(), note?.trim() || '', finalCategoryId, appSource]
    );

    return NextResponse.json({ success: true, link: res.rows[0] });
  } catch (error) {
    console.error('Error creating link:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
