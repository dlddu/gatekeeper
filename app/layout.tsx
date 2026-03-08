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
  description: "Gatekeeper - Access Request Management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gatekeeper",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div data-testid="app-shell">
          {children}
          <div data-testid="offline-indicator" style={{ display: "none" }}>
            You are offline
          </div>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered:', registration);
                    })
                    .catch(function(error) {
                      console.log('SW registration failed:', error);
                    });
                });

                function updateOfflineIndicator() {
                  var indicator = document.querySelector('[data-testid="offline-indicator"]');
                  if (indicator) indicator.style.display = navigator.onLine ? 'none' : 'block';
                }

                window.addEventListener('online', updateOfflineIndicator);
                window.addEventListener('offline', updateOfflineIndicator);

                // 페이지 로드 시 초기 오프라인 상태 반영
                updateOfflineIndicator();
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
