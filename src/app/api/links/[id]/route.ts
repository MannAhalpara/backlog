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
    const cleanStr = urlStr.toLowerCase();
    if (cleanStr.includes('linkedin.com')) return 'linkedin';
    if (cleanStr.includes('instagram.com')) return 'instagram';
    if (cleanStr.includes('medium.com')) return 'medium';
    if (cleanStr.includes('youtube.com') || cleanStr.includes('youtu.be')) return 'youtube';
    return 'other';
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { url, note, category_id } = body;

    const updates: string[] = [];
    const dbParams: any[] = [];
    let paramIndex = 1;

    if (url !== undefined) {
      if (url.trim() === '') {
        return NextResponse.json({ error: 'URL cannot be empty.' }, { status: 400 });
      }
      updates.push(`url = $${paramIndex++}`);
      dbParams.push(url.trim());

      const appSource = getAppSource(url.trim());
      updates.push(`app_source = $${paramIndex++}`);
      dbParams.push(appSource);
    }

    if (note !== undefined) {
      updates.push(`note = $${paramIndex++}`);
      dbParams.push(note.trim());
    }

    if (category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      dbParams.push(category_id); // can be null
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);

    const queryStr = `
      UPDATE links 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;
    dbParams.push(id, user.userId);

    const res = await query(queryStr, dbParams);

    if (!res || res.rowCount === 0) {
      return NextResponse.json({ error: 'Link not found or not updated.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, link: res.rows[0] });
  } catch (error) {
    console.error('Error updating link:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const res = await query('DELETE FROM links WHERE id = $1 AND user_id = $2', [id, user.userId]);

    if (!res || res.rowCount === 0) {
      return NextResponse.json({ error: 'Link not found or not deleted.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
