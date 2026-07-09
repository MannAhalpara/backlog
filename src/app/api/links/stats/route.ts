import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.userId;

    const [totalRes, pendingRes, visitedRes, doneWeekRes] = await Promise.all([
      // Total saved: pending + done (excludes removed)
      query("SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status != 'removed'", [userId]),
      // Pending links
      query("SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'pending'", [userId]),
      // Visited but not closed: clicked_at is set, status is pending, and clicked_at is older than 2 minutes
      query(
        "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'pending' AND clicked_at IS NOT NULL AND clicked_at < NOW() - INTERVAL '2 minutes'",
        [userId]
      ),
      // Done this week: status = done, updated_at within 7 days
      query(
        "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'done' AND updated_at >= NOW() - INTERVAL '7 days'",
        [userId]
      ),
    ]);

    return NextResponse.json({
      totalSaved: totalRes.rows[0].count,
      pending: pendingRes.rows[0].count,
      visitedNotClosed: visitedRes.rows[0].count,
      doneThisWeek: doneWeekRes.rows[0].count,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
