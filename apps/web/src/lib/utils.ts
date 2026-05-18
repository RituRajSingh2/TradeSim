import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Determine color class based on positive/negative value
 */
export function pnlColor(value: number): string {
  if (value > 0) return 'text-positive';
  if (value < 0) return 'text-negative';
  return 'text-text-secondary';
}

/**
 * Determine background color class based on positive/negative value
 */
export function pnlBgColor(value: number): string {
  if (value > 0) return 'bg-positive-bg';
  if (value < 0) return 'bg-negative-bg';
  return 'bg-bg-tertiary';
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
