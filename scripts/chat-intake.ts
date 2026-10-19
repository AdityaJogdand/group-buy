// Try intake by hand: type buyer messages, see what the agent parses or asks.
// Run: npm run chat   (empty line, Ctrl+C or Ctrl+D to quit)
import { createInterface } from 'node:readline';
import { intake } from '../lib/intake.ts';
import type { ChatMessage } from '../lib/llm.ts';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompt = () => process.stdout.write('buyer> ');
let history: ChatMessage[] = [];
prompt();
for await (const line of rl) {
  const text = line.trim();
  if (!text) break;
  history.push({ role: 'user', content: text });
  const result = await intake(history);
  if ('ask' in result) {
    console.log(`agent> ${result.ask}`);
    history.push({ role: 'assistant', content: result.ask });
  } else {
    console.log('parsed>', result, '\n--- new buyer ---');
    history = [];
  }
  prompt();
}
rl.close();
