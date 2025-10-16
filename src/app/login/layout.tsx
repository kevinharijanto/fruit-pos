import { DarkModeProvider } from "@/contexts/DarkModeContext";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-svh bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased">
        <DarkModeProvider>
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}