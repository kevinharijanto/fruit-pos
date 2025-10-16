"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full" | "responsive";
  className?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  preventBodyScroll?: boolean;
}

const sizeClasses = {
  sm: "max-w-md mx-4 sm:mx-6",
  // Consistent compact desktop width (max-w-lg), full-width on mobile for all common sizes
  md: "max-w-full sm:max-w-lg mx-2 sm:mx-6",
  lg: "max-w-full sm:max-w-lg mx-2 sm:mx-6",
  xl: "max-w-full sm:max-w-lg mx-2 sm:mx-6",
  full: "max-w-full mx-2 sm:mx-4",
  // Alias with the same behavior as md/lg/xl above
  responsive: "max-w-full sm:max-w-lg mx-2 sm:mx-6",
};

export default function Modal({
  isOpen,
  onClose,
  children,
  size = "responsive",
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  preventBodyScroll = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    
    // Focus management
    if (modalRef.current) {
      modalRef.current.focus();
    }

    // Prevent body scroll
    if (preventBodyScroll) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!isIOS) {
        document.body.style.overflow = "hidden";
      }
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      
      if (preventBodyScroll) {
        document.body.style.overflow = "";
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
      }
    };
  }, [isOpen, onClose, preventBodyScroll]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
      onClick={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className={cn(
          "relative bg-white rounded-xl shadow-xl w-full max-h-[100vh] sm:max-h-[90vh] overflow-hidden dark:bg-gray-800",
          sizeClasses[size],
          className
        )}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="overflow-y-auto max-h-[85vh] sm:max-h-[90vh]">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div className={cn("px-6 py-4 border-b border-gray-200 dark:border-gray-700", className)}>
      {children}
    </div>
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn(
      "px-6 py-4 border-t border-gray-200 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700",
      className
    )}>
      {children}
    </div>
  );
}