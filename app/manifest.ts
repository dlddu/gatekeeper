import type { MetadataRoute } from 'next';

// output: export 모드에서 manifest 라우트를 정적으로 빌드하기 위해 필요.
export const dynamic = 'force-static';

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
