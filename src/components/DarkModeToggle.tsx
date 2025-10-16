"use client";

import { useDarkMode } from "@/contexts/DarkModeContext";

export default function DarkModeToggle() {
  const { darkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        // Sun icon for light mode
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        // Moon icon for dark mode
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}