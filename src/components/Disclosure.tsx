"use client";

import { useState } from "react";
import { Icon } from "./icons";

/** A "＋ Add …" panel that expands in place — no modal, works well on a phone. */
export default function Disclosure({
  label, children, defaultOpen = false, tone = "primary",
}: { label: string; children: React.ReactNode; defaultOpen?: boolean; tone?: "primary" | "ghost" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={tone === "primary" ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
      >
        <Icon.plus className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`} />
        {open ? "Close" : label}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
