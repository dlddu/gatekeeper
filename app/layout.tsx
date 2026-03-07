import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gatekeeper",
  description: "Gatekeeper Approval Gateway Service",
  // manifest link: manifest.json
  manifest: "/manifest.json",
  // apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-mobile-web-app-title
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Gatekeeper" },
  icons: {
    // apple-touch-icon
    apple: "/icons/icon-192x192.png",
  },
};

// viewport: width=device-width, initial-scale=1
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div data-testid="app-shell">
          {children}
        </div>
        <div
          data-testid="offline-indicator"
          aria-label="오프라인"
          id="offline-indicator"
          style={{ display: "none" }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function() {
                      return navigator.serviceWorker.ready;
                    })
                    .then(function() {
                      // SW가 active되면 현재 페이지를 캐시에 저장 (오프라인 폴백용)
                      return caches.open('gatekeeper-v1').then(function(cache) {
                        return cache.add('/');
                      });
                    })
                    .catch(function(error) {
                      console.log('SW setup error:', error);
                    });
                });
              }

              function updateOnlineStatus() {
                var indicator = document.getElementById('offline-indicator');
                if (indicator) {
                  indicator.style.display = navigator.onLine ? 'none' : 'block';
                }
              }

              window.addEventListener('online', updateOnlineStatus);
              window.addEventListener('offline', updateOnlineStatus);
              updateOnlineStatus();
            `,
          }}
        />
      </body>
    </html>
  );
}
