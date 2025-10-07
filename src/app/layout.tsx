// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

// src/app/layout.tsx
export const metadata = {
  title: 'Fruit POS',
  themeColor: '#16a34a',
  manifest: '/manifest.webmanifest',          // ✅ add this line
  appleWebApp: {
    capable: true,
    title: 'Fruit POS',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icons/fruit-pos-icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};
// app/layout.tsx (if you manage viewport manually)
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-svh bg-[--color-app-bg] text-gray-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
