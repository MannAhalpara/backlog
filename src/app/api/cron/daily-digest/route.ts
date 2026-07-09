import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendEmail } from '@/lib/nodemailer';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get('secret');
    
    const cronSecret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';
    
    // Auth check: either Vercel Bearer authorization header or local development query param secret
    if (
      authHeader !== `Bearer ${cronSecret}` && 
      !(isDev && secretParam === cronSecret)
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 1. Database cleanups
    // Delete expired OTP codes
    const otpCleanRes = await query('DELETE FROM otp_codes WHERE expires_at < NOW()');
    console.log(`Cleaned up ${otpCleanRes.rowCount} expired OTP codes.`);

    // Delete expired sessions
    const sessionCleanRes = await query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    console.log(`Cleaned up ${sessionCleanRes.rowCount} expired user sessions.`);

    // 2. Fetch all users
    const usersRes = await query('SELECT * FROM users');
    const users = usersRes.rows;
    let emailsSent = 0;

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    // 3. For each user, send daily digest if they have pending items
    for (const user of users) {
      const userId = user.id;

      // Query reminders due: status = pending, remind_at is not null and <= NOW
      const remindersRes = await query(
        `SELECT l.*, c.name as category_name 
         FROM links l 
         LEFT JOIN categories c ON l.category_id = c.id 
         WHERE l.user_id = $1 
           AND l.status = 'pending' 
           AND l.remind_at IS NOT NULL 
           AND l.remind_at <= NOW() 
         ORDER BY l.remind_at ASC`,
        [userId]
      );

      // Query all pending links (excluding due reminders, to list separately)
      // If remind_at is in the future, it is not due yet, but still part of pending backlog.
      // If remind_at is null, it's normal pending backlog.
      const pendingRes = await query(
        `SELECT l.*, c.name as category_name 
         FROM links l 
         LEFT JOIN categories c ON l.category_id = c.id 
         WHERE l.user_id = $1 
           AND l.status = 'pending' 
           AND (l.remind_at IS NULL OR l.remind_at > NOW())
         ORDER BY l.created_at DESC`,
        [userId]
      );

      const reminders = remindersRes.rows;
      const pending = pendingRes.rows;

      // Only send email if there are items to report
      if (reminders.length === 0 && pending.length === 0) {
        continue;
      }

      // Format reminders HTML
      let remindersHtml = '';
      if (reminders.length > 0) {
        remindersHtml = `
          <div style="margin-bottom: 28px;">
            <h2 style="font-size: 16px; font-weight: 600; color: #b91c1c; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #fee2e2; padding-bottom: 6px;">🚨 Reminders Due</h2>
            <ul style="padding-left: 0; list-style: none; margin: 0;">
              ${reminders
                .map((r) => {
                  const displayTitle = r.note ? r.note : r.url;
                  return `
                  <li style="padding: 12px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 15px;">
                      <a href="${baseUrl}/api/links/${r.id}/open" target="_blank" style="color: #b91c1c; text-decoration: underline;">
                        ${displayTitle}
                      </a>
                    </div>
                    <div style="font-size: 13px; color: #7f1d1d; margin-top: 4px; word-break: break-all;">
                      URL: ${r.url} ${r.category_name ? `• Category: ${r.category_name}` : ''}
                    </div>
                  </li>`;
                })
                .join('')}
            </ul>
          </div>
        `;
      }

      // Format pending backlog HTML grouped by category
      let backlogHtml = '';
      if (pending.length > 0) {
        // Group by category
        const grouped: { [key: string]: any[] } = {};
        for (const link of pending) {
          const categoryName = link.category_name || 'Uncategorized';
          if (!grouped[categoryName]) {
            grouped[categoryName] = [];
          }
          grouped[categoryName].push(link);
        }

        let groupsContent = '';
        for (const [catName, links] of Object.entries(grouped)) {
          groupsContent += `
            <div style="margin-bottom: 16px;">
              <h3 style="font-size: 14px; font-weight: 600; color: #4b5563; margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px;">${catName}</h3>
              <ul style="padding-left: 0; list-style: none; margin: 0;">
                ${links
                  .map((l) => {
                    const displayTitle = l.note ? l.note : l.url;
                    return `
                    <li style="padding: 8px 12px; border-left: 3px solid #2563eb; background-color: #fafafa; margin-bottom: 6px; border-radius: 0 4px 4px 0;">
                      <div style="font-weight: 500; font-size: 14px;">
                        <a href="${baseUrl}/api/links/${l.id}/open" target="_blank" style="color: #2563eb; text-decoration: none;">
                          ${displayTitle}
                        </a>
                      </div>
                      <div style="font-size: 12px; color: #6b7280; margin-top: 2px; word-break: break-all;">
                        Source: ${l.app_source} • URL: ${l.url}
                      </div>
                    </li>`;
                  })
                  .join('')}
              </ul>
            </div>
          `;
        }

        backlogHtml = `
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #374151; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">📥 Pending Backlog</h2>
            ${groupsContent}
          </div>
        `;
      }

      // Compile and send email
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Backlog Digest</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; border-collapse: collapse; overflow: hidden;">
            <tr>
              <td style="padding: 24px; background-color: #ffffff;">
                <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px 0; border-bottom: 2px solid #f3f4f6; padding-bottom: 12px;">Daily Backlog Digest</h1>
                
                ${remindersHtml}
                ${backlogHtml}

                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  <tr>
                    <td align="center">
                      <a href="${baseUrl}/dashboard" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: 500; font-size: 14px; border-radius: 6px; border: 1px solid #1d4ed8;">
                        Open Backlog Dashboard
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                Sent automatically by your personal Backlog App.
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await sendEmail({
        to: user.email,
        subject: `Backlog Digest - ${new Date().toLocaleDateString()}`,
        html: emailHtml,
      });

      emailsSent++;
    }

    return NextResponse.json({
      success: true,
      cleanedExpiredOtps: otpCleanRes.rowCount,
      cleanedExpiredSessions: sessionCleanRes.rowCount,
      emailsSentCount: emailsSent,
    });
  } catch (error) {
    console.error('Error in daily digest cron:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
