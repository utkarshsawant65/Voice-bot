// Pre-generates answers + MP3s for the example chips, so they play instantly and cost no credits.
// Usage (dev server running): node scripts/generate-examples.mjs 1 2 5   (no numbers = all)
// Add --keep-text to voice the answers already written in lib/examples.json instead of asking the model.
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const file = "lib/examples.json";
const examples = JSON.parse(readFileSync(file, "utf8"));
const keepText = process.argv.includes("--keep-text");
const picks = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number);
const indexes = picks.length ? picks.map((n) => n - 1) : examples.map((_, i) => i);

mkdirSync("public/audio", { recursive: true });

for (const i of indexes) {
  const ex = examples[i];
  console.log(`\n${i + 1}. ${ex.question}`);

  let text = ex.answer;
  if (!keepText) {
    const chat = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: ex.question }], sessionId: "generate", source: "generate" }),
    });
    const data = await chat.json();
    if (!data.text) throw new Error(`chat failed: ${data.error}`);
    text = data.text;
  }
  console.log(text);

  const speak = await fetch(`${BASE}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!speak.ok) throw new Error(`speak failed: ${speak.status}`);
  const audio = `/audio/example-${i + 1}.mp3`;
  writeFileSync(`public${audio}`, Buffer.from(await speak.arrayBuffer()));

  examples[i] = { ...ex, answer: text, audio };
  console.log(`saved ${audio} (${text.length} characters of ElevenLabs credit)`);
}

writeFileSync(file, JSON.stringify(examples, null, 2) + "\n");
