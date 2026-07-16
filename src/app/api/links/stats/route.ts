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

    const [totalRes, pendingRes, visitedRes, doneWeekRes, completedTodayRes, completedThisWeekRes, markedForLaterRes, weeklyProgressRes] = await Promise.all([
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
      // Completed today: status = done, updated_at::date = CURRENT_DATE (calendar day)
      query(
        "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'done' AND updated_at::date = CURRENT_DATE",
        [userId]
      ),
      // Completed this week: status = done, updated_at >= date_trunc('week', NOW()) (calendar week, starts Monday)
      query(
        "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'done' AND updated_at >= date_trunc('week', NOW())",
        [userId]
      ),
      // Marked for later: status = pending, remind_at is not null
      query(
        "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'pending' AND remind_at IS NOT NULL",
        [userId]
      ),
      // Weekly progress for current calendar week (Monday to Sunday)
      query(
        `WITH days AS (
          SELECT (date_trunc('week', NOW()) + (i || ' day')::interval)::date as day
          FROM generate_series(0, 6) i
        )
        SELECT 
          days.day::text as day,
          TO_CHAR(days.day, 'Dy') as day_name,
          COALESCE(s.saved_count, 0) as saved_count,
          COALESCE(c.completed_count, 0) as completed_count
        FROM days
        LEFT JOIN (
          SELECT created_at::date as day, COUNT(*)::int as saved_count
          FROM links
          WHERE user_id = $1 AND status != 'removed'
          GROUP BY created_at::date
        ) s ON days.day = s.day
        LEFT JOIN (
          SELECT updated_at::date as day, COUNT(*)::int as completed_count
          FROM links
          WHERE user_id = $1 AND status = 'done'
          GROUP BY updated_at::date
        ) c ON days.day = c.day
        ORDER BY days.day`,
        [userId]
      ),
    ]);

    return NextResponse.json({
      totalSaved: totalRes.rows[0].count,
      pending: pendingRes.rows[0].count,
      visitedNotClosed: visitedRes.rows[0].count,
      doneThisWeek: doneWeekRes.rows[0].count,
      completedToday: completedTodayRes.rows[0].count,
      completedThisWeek: completedThisWeekRes.rows[0].count,
      markedForLater: markedForLaterRes.rows[0].count,
      weeklyProgress: weeklyProgressRes.rows.map((row) => ({
        day: row.day,
        dayName: row.day_name,
        saved: row.saved_count,
        completed: row.completed_count,
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
