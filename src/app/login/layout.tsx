import { DarkModeProvider } from "@/contexts/DarkModeContext";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DarkModeProvider>
      {children}
    </DarkModeProvider>
  );
}