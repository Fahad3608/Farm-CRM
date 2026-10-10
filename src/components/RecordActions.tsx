"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Native popovers escape card/table clipping and support Escape and light dismissal. */
export default function RecordActions({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const close = () => panel.current?.hidePopover();
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) close();
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" popoverTarget={id} aria-expanded={open} aria-controls={id}
      aria-label={label} title={label} className="btn-ghost btn-sm shrink-0">
      <span aria-hidden="true">⋯</span> Actions
    </button>
    <div ref={panel} id={id} popover="auto" role="group" aria-label={label}
      className="fixed m-0 w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-line bg-surface p-2 text-left text-ink shadow-xl"
      style={{ inset: "auto", ...position, maxHeight: "calc(100dvh - 1rem)" }}
      onToggle={(event) => {
        const showing = event.newState === "open";
        setOpen(showing);
        if (showing && trigger.current && panel.current) {
          const rect = trigger.current.getBoundingClientRect();
          const popup = panel.current.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(rect.right - popup.width, window.innerWidth - popup.width - 8)),
            top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - popup.height - 8)),
          });
        }
      }}>
      <p className="px-2 py-1 text-[12px] font-medium text-muted">{label}</p>
      {children}
    </div>
  </>;
}
