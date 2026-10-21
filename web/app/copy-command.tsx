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
    <div className="flex items-center gap-3 rounded-2xl bg-ink py-2 pl-5 pr-2 text-lime">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-2 text-sm">{command}</code>
      <button type="button" onClick={copy}
        className="press shrink-0 rounded-xl bg-lime px-4 py-2 text-sm font-bold text-ink" aria-live="polite">
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
