"use client";

import { useEffect, useState } from "react";

/** True when the URL has ?debug=1 (read after mount; avoids a Suspense boundary). */
export function useDebugFlag(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is browser-only
    setOn(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);
  return on;
}
