import { useCallback, useState } from "react";

// Both hooks are callback refs that return a cleanup (React 19), so each
// observer is disconnected when its element detaches.

/** Becomes true the first time the element nears the viewport, then stays. */
export function useInViewOnce<T extends Element>(rootMargin = "300px") {
  const [inView, setInView] = useState(false);
  const ref = useCallback(
    (node: T | null) => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin }
      );
      if (node) {
        // False positive: the rule only models effect cleanups; this callback
        // ref returns `observer.disconnect` below, which React 19 runs on detach.
        // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
        observer.observe(node);
      }
      return () => observer.disconnect();
    },
    [rootMargin]
  );
  return [ref, inView] as const;
}

/** Tracks the element's content width in CSS pixels (0 until measured). */
export function useElementWidth<T extends Element>() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: T | null) => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    if (node) {
      // Same false positive as above: the returned cleanup disconnects.
      // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
