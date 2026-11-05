"use client";
// Small pieces used on more than one screen: the money-state chip and the share button.
import { useState } from "react";

// Where the buyer's money is. Always a word plus a dot, never colour alone.
const chips = {
  held: ["Held", "text-hold"],
  charged: ["Charged", "text-save"],
  pending: ["Payment pending", "text-hold"],
  released: ["Released", "text-muted"],
} as const;

export function MoneyChip({ status }: { status: string }) {
  const [label, tone] = chips[
    status === "PENDING" || status === "HELD" ? "held" : status === "CAPTURED" ? "charged" : status === "CAPTURE_FAILED" ? "pending" : "released"
  ];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium shadow-[inset_0_0_0_1px_var(--line)] ${tone}`}>
      <span aria-hidden className="size-2 rounded-full bg-current" /> {label}
    </span>
  );
}

// Shares the join link for a group (never the buyer's own hold page): native share sheet, else copy.
export function ShareButton({ id, name, className }: { id: string; name: string; className: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}/?join=${id}`;
    try {
      if (navigator.share) return void (await navigator.share({ title: name, text: `Join me on ${name}: the more of us, the lower the price.`, url }));
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* share sheet dismissed */ }
  };
  return <button type="button" onClick={share} aria-live="polite" className={className}>{copied ? "Link copied" : "Share this group"}</button>;
}
