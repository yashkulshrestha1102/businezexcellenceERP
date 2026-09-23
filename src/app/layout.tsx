import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Roster Pro — Employee & Attendance Management',
  description: 'Reliable employee and attendance management system',
  applicationName: 'Roster Pro',
  authors: [{ name: 'Roster Pro' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Roster Pro',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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