"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import DarkModeToggle from "@/components/DarkModeToggle";

interface NavigationItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

interface NavigationProps {
  items: NavigationItem[];
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  className?: string;
}

function NavIcon({ name }: { name: "home" | "orders" | "seller-orders" | "sellers" | "items" | "customers" }) {
  const cls = "w-5 h-5";
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
      );
    case "orders":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10,9 9,9 8,9" />
        </svg>
      );
    case "seller-orders":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10,9 9,9 8,9" />
          <circle cx="12" cy="13" r="2" fill="currentColor" />
        </svg>
      );
    case "sellers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="m23 21-3.5-3.5M21 16v4"/>
        </svg>
      );
    case "items":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "customers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cls} stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m23 21-3.5-3.5M21 16v4" />
        </svg>
      );
  }
}

export function NavigationItems({ items, onItemClick }: { 
  items: NavigationItem[]; 
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary-50 text-primary-700 border border-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800"
                : "text-gray-700 hover:bg-gray-50 border border-transparent dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full dark:bg-primary-900/50 dark:text-primary-300">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Navigation({ 
  items, 
  collapsed = false, 
  onCollapseChange,
  className 
}: NavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
    
    // Store preference
    localStorage.setItem("sidebarCollapsed", newCollapsed ? "1" : "0");
  };

  // Load preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      const savedCollapsed = saved === "1";
      setIsCollapsed(savedCollapsed);
      onCollapseChange?.(savedCollapsed);
    }
  }, [onCollapseChange]);

  if (isCollapsed) {
    return (
      <div className={cn(
        "hidden md:flex flex-col w-16 bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700",
        className
      )}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCollapseToggle}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Expand sidebar"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="flex flex-col gap-2 px-2">
            {items.map((item) => {
              const pathname = usePathname();
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center p-2 rounded-lg transition-all duration-200",
                    active
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  )}
                  title={item.label}
                >
                  {item.icon}
                </Link>
              );
            })}
          </nav>
        </div>
        
        {/* Logout button for collapsed sidebar */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <LogoutButton collapsed={true} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "hidden md:flex flex-col w-64 bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700",
      className
    )}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white text-sm font-bold shadow-sm">
              F
            </div>
            <div>
              <div className="font-semibold text-gray-900 leading-none dark:text-gray-100">Fruit POS</div>
              <div className="text-xs text-gray-500 leading-none mt-1 dark:text-gray-400">Home Delivery System</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <button
              onClick={handleCollapseToggle}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Collapse sidebar"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto">
        <NavigationItems items={items} />
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center dark:bg-gray-700">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">Admin User</div>
            <div className="text-xs text-gray-500 truncate dark:text-gray-400">admin@fruitpos.com</div>
          </div>
        </div>
        <LogoutButton />
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Version 1.0 • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

// Mobile Navigation Component
export function MobileNavigation({ items }: { items: NavigationItem[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-200 dark:bg-gray-900/90 dark:border-gray-700 safe-area-t safe-area-x">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600 text-white text-sm font-bold">
              F
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Fruit POS</span>
          </div>
          
          <DarkModeToggle />
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col dark:bg-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary-600 text-white text-sm font-bold">
                  F
                </div>
                <span className="font-semibold text-gray-900 dark:text-gray-100">Fruit POS</span>
              </div>
              <div className="flex items-center gap-2">
                <DarkModeToggle />
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <NavigationItems items={items} onItemClick={() => setIsOpen(false)} />
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <LogoutButton onClick={() => setIsOpen(false)} />
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                Version 1.0 • {new Date().getFullYear()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Default navigation items for the app
export const defaultNavItems: NavigationItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: <NavIcon name="home" />,
  },
  {
    href: "/orders",
    label: "Orders",
    icon: <NavIcon name="orders" />,
  },
  {
    href: "/seller-orders",
    label: "Seller Orders",
    icon: <NavIcon name="seller-orders" />,
  },
  {
    href: "/sellers",
    label: "Sellers",
    icon: <NavIcon name="sellers" />,
  },
  {
    href: "/items",
    label: "Items",
    icon: <NavIcon name="items" />,
  },
  {
    href: "/customers",
    label: "Customers",
    icon: <NavIcon name="customers" />,
  },
];

// Logout Button Component
function LogoutButton({ onClick, collapsed = false }: { onClick?: () => void; collapsed?: boolean }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push("/login");
      onClick?.();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={cn(
          "w-full flex items-center justify-center p-2 rounded-lg transition-all duration-200",
          "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title="Lock/Logout"
      >
        {isLoggingOut ? (
          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={cn(
        "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/30",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
      title="Lock/Logout"
    >
      {isLoggingOut ? (
        <>
          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Locking...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Lock</span>
        </>
      )}
    </button>
  );
}