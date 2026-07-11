'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ShareReceiverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const title = searchParams.get('title') || '';
    const text = searchParams.get('text') || '';
    const url = searchParams.get('url') || '';

    let extractedUrl = '';

    // 1. If url query parameter is present and non-empty, use it directly
    if (url && url.trim() !== '') {
      extractedUrl = url.trim();
    } else if (text && text.trim() !== '') {
      // 2. Extract the first valid URL from the text query param
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      const match = text.match(urlRegex);
      if (match && match[0]) {
        extractedUrl = match[0].trim();
      }
    }

    // 3. Redirect (client-side) to home page with shared_url parameter
    if (extractedUrl) {
      router.replace(`/?shared_url=${encodeURIComponent(extractedUrl)}`);
    } else {
      router.replace('/');
    }
  }, [router, searchParams]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center',
      padding: '24px',
    }}>
      <div 
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}
      />
      <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--foreground)', marginBottom: '8px' }}>
        Processing shared link...
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
        Please wait while we redirect you.
      </p>
    </div>
  );
}

export default function ShareReceiverPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        textAlign: 'center',
        padding: '24px',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--foreground)' }}>
          Loading share receiver...
        </h2>
      </div>
    }>
      <ShareReceiverContent />
    </Suspense>
  );
}
