import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and verification code are required.' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    // Verify OTP code
    const otpRes = await query(
      'SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > NOW()',
      [trimmedEmail, trimmedCode]
    );

    if (!otpRes || otpRes.rowCount === 0) {
      return NextResponse.json({ error: 'Invalid or expired verification code.' }, { status: 400 });
    }

    // Clean up OTP codes for this email
    await query('DELETE FROM otp_codes WHERE email = $1', [trimmedEmail]);

    // Check if user exists
    let userRes = await query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
    let user;

    if (!userRes || userRes.rowCount === 0) {
      // Create new user
      const insertRes = await query('INSERT INTO users (email) VALUES ($1) RETURNING *', [trimmedEmail]);
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
    }

    // Create session in database
    const token = await createSession(user.id);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in verify-otp API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
