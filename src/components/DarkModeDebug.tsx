"use client";

import { useDarkMode } from "@/contexts/DarkModeContext";
import { useEffect, useState } from "react";

export default function DarkModeDebug() {
  const { darkMode } = useDarkMode();
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [elementClasses, setElementClasses] = useState<string[]>([]);

  useEffect(() => {
    // Get CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const vars: Record<string, string> = {};
    
    // Check key color variables
    const importantVars = [
      '--color-text-primary',
      '--color-text-secondary',
      '--color-bg-primary',
      '--color-bg-secondary',
      '--color-border-primary'
    ];
    
    importantVars.forEach(varName => {
      vars[varName] = rootStyle.getPropertyValue(varName).trim();
    });
    
    setCssVars(vars);
    setElementClasses(Array.from(document.documentElement.classList));
  }, [darkMode]);

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-w-sm">
      <h3 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">Dark Mode Debug</h3>
      
      <div className="space-y-2 text-xs">
        <div>
          <span className="font-medium">Dark Mode State:</span>{" "}
          <span className={darkMode ? "text-green-600" : "text-red-600"}>
            {darkMode ? "ON" : "OFF"}
          </span>
        </div>
        
        <div>
          <span className="font-medium">HTML Classes:</span>{" "}
          <span className="text-blue-600">{elementClasses.join(", ") || "none"}</span>
        </div>
        
        <div>
          <span className="font-medium">CSS Variables:</span>
          <div className="mt-1 space-y-1">
            {Object.entries(cssVars).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                <span className="text-gray-900 dark:text-gray-100">{value || "undefined"}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <span className="font-medium">Input Test:</span>
          <div className="mt-1 space-y-1">
            <input 
              type="text" 
              placeholder="Default input (should be readable)"
              className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
            />
            <input 
              type="text" 
              placeholder="With dark classes"
              className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:text-white dark:bg-gray-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
}