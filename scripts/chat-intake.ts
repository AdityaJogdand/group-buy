// Try intake + grouping by hand: type buyer messages, see what the agent asks or which deal it picks.
// Run: npm run chat   (empty line, Ctrl+C or Ctrl+D to quit). Opens real deals in groupbuy.db.
import { createInterface } from 'node:readline';
import { intake } from '../lib/intake.ts';
import { group } from '../lib/grouping.ts';
import { getDeal } from '../lib/deals.ts';
import type { ChatMessage } from '../lib/llm.ts';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompt = () => process.stdout.write('buyer> ');
let history: ChatMessage[] = [];
const ask = (text: string) => { console.log(`agent> ${text}`); history.push({ role: 'assistant', content: text }); };
const done = (text: string) => { console.log(`agent> ${text}\n--- new buyer ---`); history = []; };

prompt();
for await (const line of rl) {
  const text = line.trim();
  if (!text) break;
  history.push({ role: 'user', content: text });
  const parsed = await intake(history);
  if ('ask' in parsed) ask(parsed.ask);
  else if ('declined' in parsed) done('No problem. Nothing was held or charged.');
  else {
    const grouped = group(parsed);
    if ('ask' in grouped) ask(grouped.ask);
    else {
      const d = getDeal(grouped.dealId)!;
      done(`${grouped.isNew ? 'Opened' : 'Joining'} deal ${d.id}: ${d.product}, target ${d.target} buyers, ` +
        `closes ${d.closes_at}. Next: PayPal hold for $${parsed.maxCents / 100}.`);
    }
  }
  prompt();
}
rl.close();
