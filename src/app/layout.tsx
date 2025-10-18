// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { DarkModeProvider } from "@/contexts/DarkModeContext";

// src/app/layout.tsx
export const metadata = {
  title: 'Fruit POS',
  manifest: '/manifest.webmanifest',      
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
export const viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  userScalable: false
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-svh bg-[--color-app-bg] text-[--color-text-primary] antialiased">
        <DarkModeProvider>
          <AppShell>{children}</AppShell>
        </DarkModeProvider>
      </body>
    </html>
  );
}
