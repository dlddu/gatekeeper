import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gatekeeper',
    short_name: 'Gatekeeper',
    description: 'Gatekeeper - Access Request Management',
    start_url: '/',
    display: 'standalone',
    theme_color: '#111827',
    background_color: '#f9fafb',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
