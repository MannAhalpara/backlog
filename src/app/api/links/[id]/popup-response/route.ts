import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { action, remindAtDate } = await request.json();

    // Check if link exists and belongs to the user
    const checkRes = await query('SELECT * FROM links WHERE id = $1 AND user_id = $2', [id, user.userId]);
    if (!checkRes || checkRes.rowCount === 0) {
      return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
    }

    if (action === 'done') {
      await query(
        "UPDATE links SET status = 'done', clicked_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [id, user.userId]
      );
    } else if (action === 'remove') {
      await query(
        "UPDATE links SET status = 'removed', clicked_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [id, user.userId]
      );
    } else if (action === 'remind') {
      if (!remindAtDate) {
        return NextResponse.json({ error: 'Reminder date is required.' }, { status: 400 });
      }
      const remindDate = new Date(remindAtDate);
      if (isNaN(remindDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format.' }, { status: 400 });
      }
      await query(
        "UPDATE links SET remind_at = $1, clicked_at = NULL, updated_at = NOW() WHERE id = $2 AND user_id = $3",
        [remindDate, id, user.userId]
      );
    } else if (action === 'dismiss') {
      // Clear clicked_at from the database so it's resolved server-side
      await query(
        "UPDATE links SET clicked_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
        [id, user.userId]
      );
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling popup response:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
