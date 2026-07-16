'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

interface NavbarClientProps {
  user: any;
}

export default function NavbarClient({ user }: NavbarClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavbarClick = (e: React.MouseEvent) => {
    if (isMobile) {
      const target = e.target as HTMLElement;
      // Toggle menu only if we didn't click on a link or button directly
      if (
        target.tagName !== 'A' && 
        !target.closest('a') && 
        target.tagName !== 'BUTTON' && 
        !target.closest('button')
      ) {
        setIsOpen(!isOpen);
      }
    }
  };

  return (
    <header 
      className="glass-navbar" 
      onClick={handleNavbarClick}
      style={{
        cursor: isMobile ? 'pointer' : 'default',
        padding: '12px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          width: '100%'
        }}
      >
        {/* Logo and App Title */}
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
          onClick={(e) => {
            e.stopPropagation();
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
        
        {/* Desktop navigation */}
        {!isMobile && (
          user ? (
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
          )
        )}

        {/* Mobile Hamburger menu toggle icon */}
        {isMobile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
      </div>

      {/* Mobile Drawer (hamburger style dropdown menu) */}
      {isMobile && (
        <div 
          style={{
            maxHeight: isOpen ? '250px' : '0px',
            overflow: 'hidden',
            width: '100%',
            transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, visibility 0.25s ease',
            opacity: isOpen ? 1 : 0,
            visibility: isOpen ? 'visible' : 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <nav 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              paddingTop: '16px', 
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              marginTop: '12px'
            }}
          >
            {user ? (
              <>
                <Link 
                  href="/" 
                  style={{ fontSize: '15px', fontWeight: '600', color: 'var(--muted)', padding: '8px 4px' }}
                  onClick={() => setIsOpen(false)}
                >
                  Add Link
                </Link>
                <Link 
                  href="/dashboard" 
                  style={{ fontSize: '15px', fontWeight: '600', color: 'var(--muted)', padding: '8px 4px' }}
                  onClick={() => setIsOpen(false)}
                >
                  Dashboard
                </Link>
                <a 
                  href="/api/auth/logout" 
                  className="btn btn-secondary" 
                  style={{ width: '100%', padding: '10px 14px', fontSize: '14px', textAlign: 'center', marginTop: '4px' }}
                >
                  Log Out
                </a>
              </>
            ) : (
              <Link 
                href="/login" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '10px 14px', fontSize: '14px', textAlign: 'center' }}
                onClick={() => setIsOpen(false)}
              >
                Log In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
