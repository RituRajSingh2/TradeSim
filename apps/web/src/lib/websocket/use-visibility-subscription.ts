import { useEffect, useRef, useState } from 'react';

/**
 * useVisibilitySubscription
 * 
 * Uses IntersectionObserver to detect when an element is visible in the viewport.
 * When `isVisible` is true, components can safely subscribe to high-frequency feeds.
 * Includes a margin (rootMargin) so elements slightly offscreen are pre-loaded.
 */
export function useVisibilitySubscription(
  options: IntersectionObserverInit = { rootMargin: '100px 0px', threshold: 0 }
) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(true); // Default to true so it renders initially

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [options.rootMargin, options.threshold]);

  return { containerRef, isVisible };
}
