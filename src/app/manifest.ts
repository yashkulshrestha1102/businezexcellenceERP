import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Roster Pro',
    short_name: 'Roster Pro',
    description: 'Employee and attendance management',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f6fbfa',
    theme_color: '#0d9488',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}