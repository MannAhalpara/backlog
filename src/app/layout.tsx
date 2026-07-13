import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import ParticlesBackground from '@/components/ParticlesBackground';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Backlog - Save & Track Links',
  description: 'A simple app to save and track links with categories, notes, reminders, and daily digests.',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <ParticlesBackground />
        
        {/* Glow Blobs for Glassmorphism Backdrop */}
        <div className="glow-blob" style={{ top: '8%', left: '8%', width: '320px', height: '320px', background: 'radial-gradient(circle, rgba(219, 234, 254, 0.7) 0%, rgba(219, 234, 254, 0) 70%)' }}></div>
        <div className="glow-blob" style={{ bottom: '15%', right: '8%', width: '380px', height: '380px', background: 'radial-gradient(circle, rgba(243, 232, 255, 0.7) 0%, rgba(243, 232, 255, 0) 70%)' }}></div>
        <div className="glow-blob" style={{ top: '55%', left: '50%', transform: 'translate(-50%, -50%)', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(241, 245, 249, 0.9) 0%, rgba(241, 245, 249, 0) 70%)' }}></div>

        <Navbar />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
