'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

function addToast(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substr(2, 9);
  toasts = [...toasts, { ...toast, id }];
  listeners.forEach(listener => listener(toasts));
  
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(listener => listener(toasts));
  }, 5000);
}

export const toast = {
  success: (message: string) => addToast({ message, type: 'success' }),
  error: (message: string) => addToast({ message, type: 'error' }),
  info: (message: string) => addToast({ message, type: 'info' }),
};

export function Toaster() {
  const [toastList, setToastList] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setToastList(newToasts);
    listeners.push(listener);
    
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const removeToast = (id: string) => {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(listener => listener(toasts));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toastList.map((toast) => {
        const variants = {
          success: 'bg-green-50 text-green-800 border-green-200',
          error: 'bg-red-50 text-red-800 border-red-200',
          info: 'bg-blue-50 text-blue-800 border-blue-200',
        };

        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-center justify-between p-4 rounded-lg border shadow-lg min-w-80',
              variants[toast.type]
            )}
          >
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}