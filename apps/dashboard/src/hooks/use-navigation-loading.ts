"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function useNavigationLoading(duration = 500) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(true); // true on initial load
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setIsNavigating(true);
    }

    timerRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, duration]);

  return isNavigating;
}
