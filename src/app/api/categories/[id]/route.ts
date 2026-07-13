import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

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
    const { name } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
    }

    const res = await query(
      'UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name.trim(), id, user.userId]
    );

    if (!res || res.rowCount === 0) {
      return NextResponse.json({ error: 'Category not found or not owned by user.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category: res.rows[0] });
  } catch (error) {
    console.error('Error updating category:', error);
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
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'only'; // 'only' or 'all'

    if (mode === 'all') {
      // Delete all links in the category first
      await query('DELETE FROM links WHERE category_id = $1 AND user_id = $2', [id, user.userId]);
    } else {
      // Set category_id = NULL on all links in this category (safe fallback)
      await query('UPDATE links SET category_id = NULL WHERE category_id = $1 AND user_id = $2', [id, user.userId]);
    }

    // Now delete the category
    const res = await query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, user.userId]);

    if (!res || res.rowCount === 0) {
      return NextResponse.json({ error: 'Category not found or not deleted.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
