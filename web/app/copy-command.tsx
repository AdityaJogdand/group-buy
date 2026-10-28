"use client";
import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked: the text is still selectable */ }
  };
  return (
    <div className="flex items-center gap-3 rounded-xl bg-raised py-2 pl-5 pr-2 text-ink shadow-[inset_0_0_0_1px_var(--line)]">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-2.5 text-sm text-ink/80">{command}</code>
      <button type="button" onClick={copy}
        className="btn press shrink-0 px-4 py-2 text-sm" aria-live="polite">
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

// Just the button, for places that already show the command (the terminal card on the landing page).
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-live="polite" className="btn press px-3 py-1 text-xs"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }, () => {})}>
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
