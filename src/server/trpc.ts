import { initTRPC, TRPCError } from '@trpc/server';
import { getSessionUser, createSession, deleteSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { sendEmail } from '@/lib/nodemailer';
import { cookies } from 'next/headers';

// Helper for extracting app source from URL
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

// Context type
export interface Context {
  user: { userId: string; email: string } | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure middleware
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Input validators
const sendOtpSchema = (val: any) => {
  if (!val || typeof val.email !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Valid email is required.' });
  }
  return val as { email: string };
};

const verifyOtpSchema = (val: any) => {
  if (!val || typeof val.email !== 'string' || typeof val.code !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email and verification code are required.' });
  }
  return val as { email: string; code: string };
};

const linksListSchema = (val: any) => {
  return val as {
    app?: string;
    category?: string;
    search?: string;
    sort?: 'desc' | 'asc';
    view?: 'pending' | 'history';
  };
};

const linksCreateSchema = (val: any) => {
  if (!val || typeof val.url !== 'string' || val.url.trim() === '') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'URL is required.' });
  }
  return val as {
    url: string;
    note?: string;
    categoryId?: string | null;
    newCategoryName?: string;
  };
};

const linksUpdateSchema = (val: any) => {
  if (!val || typeof val.id !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link ID is required.' });
  }
  return val as {
    id: string;
    url?: string;
    note?: string;
    category_id?: string | null;
  };
};

const linksDeleteSchema = (val: any) => {
  if (!val || typeof val.id !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link ID is required.' });
  }
  return val as { id: string };
};

const linksPopupResponseSchema = (val: any) => {
  if (!val || typeof val.id !== 'string' || typeof val.action !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link ID and action are required.' });
  }
  return val as {
    id: string;
    action: 'done' | 'remove' | 'remind' | 'dismiss';
    remindAtDate?: string;
  };
};

const categoriesUpdateSchema = (val: any) => {
  if (!val || typeof val.id !== 'string' || typeof val.name !== 'string' || val.name.trim() === '') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Category ID and name are required.' });
  }
  return val as { id: string; name: string };
};

const categoriesDeleteSchema = (val: any) => {
  if (!val || typeof val.id !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Category ID is required.' });
  }
  return val as { id: string; mode: 'only' | 'all' };
};

export const appRouter = router({
  // Auth Procedures
  auth: router({
    sendOtp: publicProcedure
      .input(sendOtpSchema)
      .mutation(async ({ input }) => {
        const trimmedEmail = input.email.trim().toLowerCase();
        if (!trimmedEmail.includes('@')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Valid email is required.' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        await query('DELETE FROM otp_codes WHERE email = $1', [trimmedEmail]);
        await query('INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)', [
          trimmedEmail,
          code,
          expiresAt,
        ]);

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
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send OTP email.' });
        }

        return { success: true };
      }),

    verifyOtp: publicProcedure
      .input(verifyOtpSchema)
      .mutation(async ({ input }) => {
        const trimmedEmail = input.email.trim().toLowerCase();
        const trimmedCode = input.code.trim();

        const otpRes = await query(
          'SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND expires_at > NOW()',
          [trimmedEmail, trimmedCode]
        );

        if (!otpRes || otpRes.rowCount === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired verification code.' });
        }

        await query('DELETE FROM otp_codes WHERE email = $1', [trimmedEmail]);

        let userRes = await query('SELECT * FROM users WHERE email = $1', [trimmedEmail]);
        let user;

        if (!userRes || userRes.rowCount === 0) {
          const insertRes = await query('INSERT INTO users (email) VALUES ($1) RETURNING *', [trimmedEmail]);
          user = insertRes.rows[0];
        } else {
          user = userRes.rows[0];
        }

        const token = await createSession(user.id);

        const cookieStore = await cookies();
        cookieStore.set('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 24 * 60 * 60, // 60 days
        });

        return { success: true };
      }),

    logout: publicProcedure
      .mutation(async () => {
        await deleteSession();
        const cookieStore = await cookies();
        cookieStore.delete('auth_token');
        return { success: true };
      }),
  }),

  // Links Procedures
  links: router({
    list: protectedProcedure
      .input(linksListSchema)
      .query(async ({ ctx, input }) => {
        const userId = ctx.user.userId;
        const app = input?.app;
        const category = input?.category;
        const search = input?.search;
        const sort = input?.sort || 'desc';
        const view = input?.view || 'pending';

        const params: any[] = [userId];
        let paramCount = 1;

        let sql = `
          SELECT l.*, c.name as category_name 
          FROM links l 
          LEFT JOIN categories c ON l.category_id = c.id 
          WHERE l.user_id = $1
        `;

        if (view === 'history') {
          sql += ` AND l.status = 'done'`;
        } else {
          sql += ` AND l.status = 'pending'`;
        }

        if (app && app !== 'all') {
          paramCount++;
          sql += ` AND l.app_source = $${paramCount}`;
          params.push(app);
        }

        if (category && category !== 'all') {
          if (category === 'null' || category === 'uncategorized') {
            sql += ` AND l.category_id IS NULL`;
          } else {
            paramCount++;
            sql += ` AND l.category_id = $${paramCount}`;
            params.push(category);
          }
        }

        if (search && search.trim() !== '') {
          paramCount++;
          sql += ` AND (l.note ILIKE $${paramCount} OR l.url ILIKE $${paramCount})`;
          params.push(`%${search.trim()}%`);
        }

        const direction = sort === 'asc' ? 'ASC' : 'DESC';
        sql += ` ORDER BY l.created_at ${direction}`;

        const res = await query(sql, params);

        const sourcesRes = await query(
          'SELECT DISTINCT app_source FROM links WHERE user_id = $1 AND status != \'removed\' ORDER BY app_source',
          [userId]
        );
        const sources = sourcesRes.rows.map((row) => row.app_source);

        return {
          links: res.rows,
          sources,
        };
      }),

    stats: protectedProcedure
      .query(async ({ ctx }) => {
        const userId = ctx.user.userId;

        const [totalRes, pendingRes, visitedRes, doneWeekRes, completedTodayRes, completedThisWeekRes, markedForLaterRes, weeklyProgressRes] = await Promise.all([
          query("SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status != 'removed'", [userId]),
          query("SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'pending'", [userId]),
          query(
            "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'pending' AND clicked_at IS NOT NULL AND clicked_at < NOW() - INTERVAL '2 minutes'",
            [userId]
          ),
          query(
            "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'done' AND updated_at >= NOW() - INTERVAL '7 days'",
            [userId]
          ),
          query(
            "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'done' AND updated_at::date = CURRENT_DATE",
            [userId]
          ),
          query(
            "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'done' AND updated_at >= date_trunc('week', NOW())",
            [userId]
          ),
          query(
            "SELECT COUNT(*)::int as count FROM links WHERE user_id = $1 AND status = 'pending' AND remind_at IS NOT NULL",
            [userId]
          ),
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

        return {
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
        };
      }),

    create: protectedProcedure
      .input(linksCreateSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.userId;
        let finalCategoryId = input.categoryId || null;

        if (input.newCategoryName && input.newCategoryName.trim() !== '') {
          const trimmedCatName = input.newCategoryName.trim();
          const catRes = await query(
            `INSERT INTO categories (user_id, name) 
             VALUES ($1, $2) 
             ON CONFLICT (user_id, name) 
             DO UPDATE SET name = EXCLUDED.name 
             RETURNING id`,
            [userId, trimmedCatName]
          );
          finalCategoryId = catRes.rows[0].id;
        }

        const appSource = getAppSource(input.url.trim());

        const res = await query(
          `INSERT INTO links (user_id, url, note, category_id, app_source, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
           RETURNING *`,
          [userId, input.url.trim(), input.note?.trim() || '', finalCategoryId, appSource]
        );

        return { success: true, link: res.rows[0] };
      }),

    update: protectedProcedure
      .input(linksUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.userId;
        const { id, url, note, category_id } = input;

        const updates: string[] = [];
        const dbParams: any[] = [];
        let paramIndex = 1;

        if (url !== undefined) {
          if (url.trim() === '') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'URL cannot be empty.' });
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
          dbParams.push(category_id);
        }

        if (updates.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update.' });
        }

        updates.push(`updated_at = NOW()`);

        const queryStr = `
          UPDATE links 
          SET ${updates.join(', ')} 
          WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
          RETURNING *
        `;
        dbParams.push(id, userId);

        const res = await query(queryStr, dbParams);

        if (!res || res.rowCount === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found or not updated.' });
        }

        return { success: true, link: res.rows[0] };
      }),

    delete: protectedProcedure
      .input(linksDeleteSchema)
      .mutation(async ({ ctx, input }) => {
        const res = await query('DELETE FROM links WHERE id = $1 AND user_id = $2', [input.id, ctx.user.userId]);
        if (!res || res.rowCount === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found.' });
        }
        return { success: true };
      }),

    pendingPopup: protectedProcedure
      .query(async ({ ctx }) => {
        const res = await query(
          `SELECT l.*, c.name as category_name 
           FROM links l
           LEFT JOIN categories c ON l.category_id = c.id
           WHERE l.user_id = $1 
             AND l.status = 'pending' 
             AND l.clicked_at IS NOT NULL 
           ORDER BY l.clicked_at ASC`,
          [ctx.user.userId]
        );
        return { links: res.rows };
      }),

    popupResponse: protectedProcedure
      .input(linksPopupResponseSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.userId;
        const { id, action, remindAtDate } = input;

        const checkRes = await query('SELECT * FROM links WHERE id = $1 AND user_id = $2', [id, userId]);
        if (!checkRes || checkRes.rowCount === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Link not found.' });
        }

        if (action === 'done') {
          await query(
            "UPDATE links SET status = 'done', clicked_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
            [id, userId]
          );
        } else if (action === 'remove') {
          await query(
            "UPDATE links SET status = 'removed', clicked_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
            [id, userId]
          );
        } else if (action === 'remind') {
          if (!remindAtDate) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Reminder date is required.' });
          }
          const remindDate = new Date(remindAtDate);
          if (isNaN(remindDate.getTime())) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid date format.' });
          }
          await query(
            "UPDATE links SET remind_at = $1, clicked_at = NULL, updated_at = NOW() WHERE id = $2 AND user_id = $3",
            [remindDate, id, userId]
          );
        } else if (action === 'dismiss') {
          await query(
            "UPDATE links SET clicked_at = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2",
            [id, userId]
          );
        }

        return { success: true };
      }),
  }),

  // Categories Procedures
  categories: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const res = await query(
          `SELECT 
            c.id, 
            c.name, 
            c.created_at,
            COUNT(l.id)::int as total_count,
            COUNT(CASE WHEN l.status = 'pending' THEN 1 END)::int as pending_count
          FROM categories c
          LEFT JOIN links l ON c.id = l.category_id
          WHERE c.user_id = $1
          GROUP BY c.id, c.name, c.created_at
          ORDER BY c.name ASC`,
          [ctx.user.userId]
        );
        return { categories: res.rows };
      }),

    update: protectedProcedure
      .input(categoriesUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        const res = await query(
          'UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
          [input.name.trim(), input.id, ctx.user.userId]
        );

        if (!res || res.rowCount === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found.' });
        }

        return { success: true, category: res.rows[0] };
      }),

    delete: protectedProcedure
      .input(categoriesDeleteSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.userId;
        const { id, mode } = input;

        if (mode === 'all') {
          await query('DELETE FROM links WHERE category_id = $1 AND user_id = $2', [id, userId]);
        } else {
          await query('UPDATE links SET category_id = NULL WHERE category_id = $1 AND user_id = $2', [id, userId]);
        }

        const res = await query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);

        if (!res || res.rowCount === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found.' });
        }

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
