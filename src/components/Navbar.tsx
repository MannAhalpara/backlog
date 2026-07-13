import Link from 'next/link';
import Image from 'next/image';
import { getSessionUser } from '@/lib/auth';

export default async function Navbar() {
  const user = await getSessionUser();

  return (
    <header className="glass-navbar">
      <div className="container flex align-center justify-between" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link 
          href={user ? "/dashboard" : "/login"} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '18px', 
            fontWeight: '700', 
            color: 'var(--foreground)',
            textDecoration: 'none'
          }}
        >
          <Image 
            src="/logo.png" 
            alt="Backlog Logo" 
            width={28} 
            height={28} 
            style={{ 
              borderRadius: '6px', 
              objectFit: 'contain'
            }}
          />
          <span>Backlog</span>
        </Link>
        
        {user ? (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--muted)' }}>
              Add Link
            </Link>
            <Link href="/dashboard" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--muted)' }}>
              Dashboard
            </Link>

            <a 
              href="/api/auth/logout" 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              Log Out
            </a>
          </nav>
        ) : (
          <nav>
            <Link href="/login" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
              Log In
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
