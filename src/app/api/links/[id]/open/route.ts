import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin;

    if (!user) {
      return NextResponse.redirect(new URL('/login', baseUrl));
    }

    const { id } = await params;

    // Find the link
    const res = await query('SELECT * FROM links WHERE id = $1 AND user_id = $2', [id, user.userId]);
    if (!res || res.rowCount === 0) {
      return NextResponse.redirect(new URL('/dashboard?error=link_not_found', baseUrl));
    }

    const link = res.rows[0];

    // Update clicked_at and updated_at
    await query(
      'UPDATE links SET clicked_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, user.userId]
    );

    // Prepend protocol if missing
    let redirectUrl = link.url.trim();
    if (!/^https?:\/\//i.test(redirectUrl)) {
      redirectUrl = 'https://' + redirectUrl;
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in link open redirect:', error);
    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin;
    return NextResponse.redirect(new URL('/dashboard?error=server_error', baseUrl));
  }
}
