import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import SaveLinkForm from './SaveLinkForm';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch user categories to populate dropdown
  const catRes = await query(
    'SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name ASC',
    [user.userId]
  );
  
  return (
    <div className="container" style={{ padding: '40px 16px', maxWidth: '600px' }}>
      <SaveLinkForm initialCategories={catRes.rows} />
    </div>
  );
}
