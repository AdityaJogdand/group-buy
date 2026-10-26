// Demo clock: CLOCK_SPEED=4320 turns 3 days into 60 s. Unset = real time.
import { settleDue } from './deals.ts';

const start = Date.now();
const speed = Number(process.env.CLOCK_SPEED ?? 1);

export function now(): Date {
  return new Date(start + (Date.now() - start) * speed);
}

let started = false;

// Settles due deals every second (capture at the reached tier, or expire). setTimeout after each tick, so a slow
// round of voids never overlaps the next one.
export function startClock(): void {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      await settleDue(now());
    } catch (e) {
      console.error('clock tick failed:', (e as Error).message);
    }
    setTimeout(tick, 1000);
  };
  tick();
}
