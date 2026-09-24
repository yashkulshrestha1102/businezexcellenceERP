import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { APP_NAME, APP_DESCRIPTION, APP_URL } from '@/lib/constants';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: `${APP_NAME} — ${APP_DESCRIPTION}`,
  description: 'Reliable employee and attendance management system',
  applicationName: APP_NAME,
  authors: [{ name: APP_NAME }],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: `${APP_NAME} — ${APP_DESCRIPTION}`,
    description: 'Reliable employee and attendance management system',
    siteName: APP_NAME,
    type: 'website',
    images: [{ url: '/icon-512.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ['/icon-512.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0f3d38',
              color: '#fff',
              border: 'none',
              fontSize: '13.5px',
              fontWeight: '600',
            },
            className: 'roster-toast',
          }}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}