"use client";
// Assistant: a fixed button (bottom right) opens a side panel styled like Claude's chat. The buyer types in plain
// words; the intake agent (/api/intake) works out product, max and deadline, asking one follow-up when unsure.
// The buyer confirms, then /api/join opens PayPal. The model only reads; nothing is held until Continue.
// Panel slides in from the right and leaves the same way; it doesn't block the page (no scrim).
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Parsed = { product_id: string; product: string; max_usd: number; list_usd: number; deadline: string | null };

const examples = ["Noise-cancelling headphones, up to $320", "The UX course by next Friday, max $180", "A 4K monitor for my desk"];
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function Spark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2c.6 4.8 2.7 7.2 8 8-5.3.8-7.4 3.2-8 8-.6-4.8-2.7-7.2-8-8 5.3-.8 7.4-3.2 8-8z" />
    </svg>
  );
}

export function Ask() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, parsed, busy]);

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.json().catch(() => ({ error: "Something went wrong. Try again." }));
  };

  const send = async (content: string) => {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: content.trim() }];
    setMsgs(next); setText(""); setParsed(null); setBusy(true);
    try {
      const out = await post("/api/intake", { messages: next });
      if (out.product_id) setParsed(out);
      else setMsgs([...next, { role: "assistant", content: out.ask ?? (out.declined ? "No problem. Nothing was held or charged." : out.error ?? "Something went wrong. Try again.") }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Can't reach the server. Try again." }]);
    }
    setBusy(false);
  };

  const confirm = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const out = await post("/api/join", { product_id: parsed.product_id, max_usd: parsed.max_usd, deadline: parsed.deadline });
      if (out.approve_url) return void (window.location.href = out.approve_url);
      // Below what any group can close at: the server explains the group price; keep talking.
      setMsgs(m => [...m, { role: "assistant", content: out.question ?? out.error ?? "Something went wrong. Try again." }]);
      setParsed(null);
    } catch {
      setMsgs(m => [...m, { role: "assistant", content: "Can't reach the server. Try again." }]);
    }
    setBusy(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Ask the assistant" aria-expanded={open}
        className={`btn press fixed bottom-5 right-5 z-40 gap-2 py-3 pl-4 pr-5 shadow-[0_12px_32px_rgba(0,0,0,0.6)] transition-[opacity,transform] duration-200 ${open ? "pointer-events-none translate-y-2 opacity-0" : ""}`}>
        <Spark /> Ask AI
      </button>

      <aside aria-label="Group Buy assistant" aria-hidden={!open} inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#141414] shadow-[-24px_0_60px_rgba(0,0,0,0.6),inset_1px_0_0_var(--line)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:w-[420px] ${
          open ? "translate-x-0" : "translate-x-full"}`}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="flex items-center gap-2 font-medium"><Spark className="size-4" /> Group Buy assistant</p>
          <div className="flex items-center gap-1">
            {msgs.length > 0 && <button type="button" onClick={() => { setMsgs([]); setParsed(null); }} className="press rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-ink">New chat</button>}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="press grid size-8 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-ink">
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6" aria-live="polite">
          {msgs.length === 0 && (
            <div className="flex h-full flex-col justify-end">
              <Spark className="size-7" />
              <p className="mt-4 text-2xl font-medium tracking-tight">What would you like to buy?</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">Say what you want and the most you&apos;d pay. I&apos;ll find the group; you approve the hold in PayPal.</p>
              <div className="mt-6 grid gap-2">
                {examples.map(x => (
                  <button key={x} type="button" onClick={() => send(x)}
                    className="press rounded-xl px-4 py-3 text-left text-sm shadow-[inset_0_0_0_1px_var(--line)] hover:bg-white/5">{x}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-5 text-[0.9375rem] leading-relaxed">
            {msgs.map((m, i) => m.role === "user"
              ? <p key={i} className="ml-auto max-w-[85%] rounded-2xl bg-[#2a2a2a] px-4 py-2.5">{m.content}</p>
              : <div key={i} className="flex gap-3"><Spark className="mt-1 size-4 shrink-0" /><p>{m.content}</p></div>)}
            {busy && !parsed && <div className="flex gap-3 text-muted"><Spark className="mt-1 size-4 shrink-0 animate-pulse" /><p>Finding your group…</p></div>}

            {/* What the agent understood, for the buyer to check before any hold. */}
            {parsed && (
              <div className="flex gap-3">
                <Spark className="mt-1 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p>Here&apos;s what I understood:</p>
                  <dl className="mt-3 grid gap-1.5 rounded-xl p-4 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
                    <div className="flex justify-between gap-4"><dt className="text-muted">Product</dt><dd className="text-right font-medium">{parsed.product}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Most you&apos;d pay</dt><dd className="font-medium tabular-nums">${parsed.max_usd}</dd></div>
                    {parsed.deadline && <div className="flex justify-between gap-4"><dt className="text-muted">Needed by</dt><dd className="font-medium">{day(parsed.deadline)}</dd></div>}
                  </dl>
                  <p className="mt-3 text-sm text-muted">PayPal holds up to ${parsed.max_usd}. You pay the group price at the deadline, or nothing.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={confirm} disabled={busy} className="btn press px-4 py-2 text-sm disabled:opacity-50">{busy ? "Opening PayPal…" : "Continue to PayPal"}</button>
                    <button type="button" onClick={() => { setParsed(null); input.current?.focus(); }} className="btn-ghost press px-4 py-2 text-sm">Change something</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={end} />
        </div>

        {/* Composer: Enter sends, Shift+Enter for a new line. */}
        <form onSubmit={e => { e.preventDefault(); send(text); }} className="p-4">
          <div className="rounded-2xl bg-[#1f1f1f] p-3 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]">
            <label htmlFor="ask" className="sr-only">Message the assistant</label>
            <textarea id="ask" ref={input} value={text} rows={2} maxLength={500} placeholder={msgs.length ? "Reply…" : "e.g. headphones, up to $320"}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
              className="block w-full resize-none bg-transparent px-1 text-[0.9375rem] outline-none placeholder:text-muted focus-visible:outline-none" />
            <div className="mt-2 flex items-center justify-between">
              <span className="px-1 text-xs text-muted">Nothing is held until you approve in PayPal</span>
              <button disabled={busy || !text.trim()} aria-label="Send" className="press grid size-8 place-items-center rounded-lg bg-ink text-black disabled:opacity-30">
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        </form>
      </aside>
    </>
  );
}
