import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendEmail } from '@/lib/nodemailer';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Clean up previous codes for this email and insert new one
    await query('DELETE FROM otp_codes WHERE email = $1', [trimmedEmail]);
    await query('INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)', [
      trimmedEmail,
      code,
      expiresAt,
    ]);

    // Send email
    const emailResult = await sendEmail({
      to: trimmedEmail,
      subject: `Your Backlog Verification Code: ${code}`,
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">Backlog Login</h2>
          <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">Enter the following 6-digit verification code to access your link backlog. This code will expire in 5 minutes.</p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #2563eb; background-color: #eff6ff; padding: 12px 24px; border-radius: 6px; border: 1px solid #bfdbfe;">
              ${code}
            </span>
          </div>
          <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">If you did not request this email, you can safely ignore it.</p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return NextResponse.json({ error: 'Failed to send OTP email. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in send-otp API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
