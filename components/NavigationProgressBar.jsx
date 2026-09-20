"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or search params change, route transition is complete
  useEffect(() => {
    // Ensure viewport scrolls to top on navigation even with sticky/fixed navbar
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }

    if (navigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setNavigating(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on links to start progress bar instantly
  useEffect(() => {
    const handleClick = (e) => {
      const target = e.target.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Only trigger for internal links that are different from current URL
      if (
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !target.getAttribute("target") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const url = new URL(href, window.location.origin);
        const currentUrl = new URL(window.location.href);

        if (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search) {
          setNavigating(true);
          setProgress(30);

          // Step up progress after brief pause
          setTimeout(() => {
            setProgress((prev) => (prev >= 30 && prev < 80 ? 75 : prev));
          }, 150);
        }
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  if (!navigating && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-transparent"
    >
      <div
        className="h-full bg-[#FFD21E] border-b border-black shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "width 150ms ease-out, opacity 200ms ease-in" : "width 300ms ease-out",
        }}
      />
    </div>
  );
}
