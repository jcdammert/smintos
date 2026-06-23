"use client";

import { useEffect, useRef } from "react";

/** Invisible element placed at the end of the messages list.
 *  On mount it scrolls itself into view so the thread opens at the newest message. */
export function ScrollToBottom() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  return <div ref={ref} />;
}
