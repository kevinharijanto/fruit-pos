"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Navigation, { MobileNavigation, defaultNavItems } from "@/components/ui/Navigation";
import QuickCreateFab from "@/components/QuickCreateFab";

type Props = { children: React.ReactNode };

export default function AppShell({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Load saved collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      setCollapsed(saved === "1");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 safe-area-t safe-area-x">
      {/* Mobile Navigation */}
      <MobileNavigation items={defaultNavItems} />
      
      {/* Desktop Navigation */}
      <Navigation
        items={defaultNavItems}
        collapsed={collapsed}
        onCollapseChange={setCollapsed}
        className="fixed left-0 top-0 h-full z-30 safe-area-t"
      />

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        collapsed ? "md:ml-16" : "md:ml-64"
      )}>
        {/* Top spacer for mobile header */}
        <div className="md:hidden h-16 safe-area-t" />
        
        {/* Main content area */}
        <main className="p-4 md:p-6 lg:p-8 safe-area-b">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Quick Create FAB */}
      <QuickCreateFab brand />
    </div>
  );
}
