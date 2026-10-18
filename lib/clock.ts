// Demo clock: CLOCK_SPEED=4320 turns 3 days into 60 s. Unset = real time.
import { expireDue } from './deals.ts';

const start = Date.now();
const speed = Number(process.env.CLOCK_SPEED ?? 1);

export function now(): Date {
  return new Date(start + (Date.now() - start) * speed);
}

let started = false;

// Expires due deals every second. setTimeout after each tick, so a slow
// round of voids never overlaps the next one.
export function startClock(): void {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      await expireDue(now());
    } catch (e) {
      console.error('clock tick failed:', (e as Error).message);
    }
    setTimeout(tick, 1000);
  };
  tick();
}
