"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

export function useMobileNavigation(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const sidebar = sidebarRef.current;
    const content = contentRef.current;
    if (!sidebar || !content) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = toggleRef.current;
    document.body.style.overflow = "hidden";
    content.inert = true;
    const controls = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      ).filter(
        (el) =>
          el.getClientRects().length &&
          getComputedStyle(el).visibility !== "hidden",
      );
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    };
    const onResize = () => {
      if (window.innerWidth > 760) setOpen(false);
    };
    sidebar.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      sidebar.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      content.inert = false;
      document.body.style.overflow = previousOverflow;
      if (trigger?.getClientRects().length) trigger.focus();
    };
  }, [open, setOpen]);

  return { sidebarRef, contentRef, toggleRef };
}
