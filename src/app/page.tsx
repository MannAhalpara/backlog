import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import SaveLinkForm from './SaveLinkForm';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<{ shared_url?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const sharedUrl = resolvedParams.shared_url;

  const user = await getSessionUser();
  if (!user) {
    const loginQuery = sharedUrl ? `?shared_url=${encodeURIComponent(sharedUrl)}` : '';
    redirect(`/login${loginQuery}`);
  }

  // Fetch user categories to populate dropdown
  const catRes = await query(
    'SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name ASC',
    [user.userId]
  );
  
  return (
    <div className="container" style={{ padding: '40px 16px', maxWidth: '600px' }}>
      <SaveLinkForm 
        key={sharedUrl || 'empty'}
        initialCategories={catRes.rows} 
        initialUrl={sharedUrl} 
      />
    </div>
  );
}
