import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import DashboardContainer from './DashboardContainer';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch all categories for this user to populate dashboard filters
  const catRes = await query(
    'SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name ASC',
    [user.userId]
  );

  return (
    <div className="container" style={{ padding: '24px 16px' }}>
      <DashboardContainer initialCategories={catRes.rows} />
    </div>
  );
}
