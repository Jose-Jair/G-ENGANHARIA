/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Remove qualquer trava residual de pointer-events deixada no <body> pelo Radix UI
 * ao fechar diálogos/modais e menus.
 */
export function restoreBodyPointerEvents() {
  if (typeof document === 'undefined') return
  // Executa imediatamente e em microtask/timeout para garantir que roda após a limpeza do Radix
  const cleanup = () => {
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = ''
    }
  }
  cleanup()
  setTimeout(cleanup, 0)
  setTimeout(cleanup, 50)
  setTimeout(cleanup, 150)
}
