import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

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
