// ============================================================
// Hivemind Prompt Generator
// ============================================================
// Prerequisites: npm install @anthropic-ai/sdk
// Usage: ANTHROPIC_API_KEY=your-key node generate-prompts.js
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const PROMPTS_FILE = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "prompts.json"
);
const DAYS_TO_GENERATE = 30;
const MODEL = "claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Add N days to a Date and return "YYYY-MM-DD" */
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Read the existing prompts array (or return an empty array). */
async function loadExistingPrompts() {
  if (!existsSync(PROMPTS_FILE)) {
    console.log("No existing prompts.json found -- starting fresh.");
    return [];
  }
  const raw = await readFile(PROMPTS_FILE, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("prompts.json does not contain a JSON array.");
  }
  console.log(`Loaded ${data.length} existing prompt(s) from prompts.json`);
  return data;
}

/** Figure out the starting date and game number for the new batch. */
function getStartingPoint(existingPrompts) {
  if (existingPrompts.length === 0) {
    // Default: start from tomorrow, game #1
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: addDays(today, 1), startNumber: 1 };
  }
  const last = existingPrompts[existingPrompts.length - 1];
  return {
    startDate: addDays(last.gameId, 1),
    startNumber: last.number + 1,
  };
}

/** Validate that a single prompt object has the right shape. */
function validatePrompt(obj, index) {
  const prefix = `Prompt #${index + 1}`;
  if (typeof obj.prompt !== "string" || obj.prompt.length === 0) {
    throw new Error(`${prefix}: missing or empty "prompt" field.`);
  }
  if (!Array.isArray(obj.rows) || obj.rows.length !== 5) {
    throw new Error(`${prefix}: "rows" must be an array of exactly 5 categories.`);
  }
  for (const row of obj.rows) {
    if (typeof row.label !== "string" || row.label.length === 0) {
      throw new Error(`${prefix}: each row needs a non-empty "label".`);
    }
    if (typeof row.icon !== "string" || row.icon.length === 0) {
      throw new Error(`${prefix}: each row needs an "icon" emoji.`);
    }
    if (!Array.isArray(row.items) || row.items.length !== 5) {
      throw new Error(
        `${prefix}: row "${row.label}" must have exactly 5 items.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Load existing prompts
  const existingPrompts = await loadExistingPrompts();
  const { startDate, startNumber } = getStartingPoint(existingPrompts);

  console.log(
    `Generating ${DAYS_TO_GENERATE} new prompts starting from ${startDate} (game #${startNumber}) ...`
  );

  // 2. Build the list of dates and numbers for the new batch
  const schedule = Array.from({ length: DAYS_TO_GENERATE }, (_, i) => ({
    gameId: addDays(startDate, i),
    number: startNumber + i,
  }));

  // 3. Call the Anthropic API
  const client = new Anthropic(); // uses ANTHROPIC_API_KEY env var

  const systemPrompt = `You are a creative game designer for "Hivemind", a daily word-guessing game.
Your job is to create engaging prompts where players try to guess the most popular answers.

Each day has:
- A fun, specific theme/prompt (e.g., "Name something you'd find in a wizard's tower")
- Exactly 5 categories (rows), each with a label, an emoji icon, and 5 popular items
- The categories should represent different angles or sub-topics of the theme
- Items should be common, well-known answers that many people would think of

Rules:
- Every theme must be UNIQUE and creative
- Items should be single words or very short phrases (1-3 words max)
- Categories should feel distinct from each other
- Use fun, relevant emoji icons for each category
- Themes should appeal to a broad audience
- Avoid anything offensive, political, or controversial`;

  const userPrompt = `Generate exactly ${DAYS_TO_GENERATE} unique Hivemind daily prompts as a JSON array.

Each element must have this exact structure:
{
  "prompt": "Theme description as a question or statement",
  "rows": [
    { "label": "Category Name", "icon": "emoji", "items": ["Item1", "Item2", "Item3", "Item4", "Item5"] },
    { "label": "Category Name", "icon": "emoji", "items": ["Item1", "Item2", "Item3", "Item4", "Item5"] },
    { "label": "Category Name", "icon": "emoji", "items": ["Item1", "Item2", "Item3", "Item4", "Item5"] },
    { "label": "Category Name", "icon": "emoji", "items": ["Item1", "Item2", "Item3", "Item4", "Item5"] },
    { "label": "Category Name", "icon": "emoji", "items": ["Item1", "Item2", "Item3", "Item4", "Item5"] }
  ]
}

Important:
- Return ONLY a valid JSON array of ${DAYS_TO_GENERATE} objects, no extra text
- Each prompt must have exactly 5 rows, each row with exactly 5 items
- All themes must be different and creative
- Use a wide variety of topics: food, travel, entertainment, sports, nature, technology, history, etc.

Respond with the JSON array only, no markdown code fences or explanation.`;

  console.log("Calling Anthropic API (this may take a minute) ...");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  // 4. Extract and parse JSON from the response
  const responseText = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  console.log(`Received response (${responseText.length} characters). Parsing ...`);

  // Strip markdown code fences if the model included them anyway
  const cleaned = responseText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let newPrompts;
  try {
    newPrompts = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse JSON from API response.");
    console.error("Raw response (first 500 chars):", cleaned.slice(0, 500));
    throw err;
  }

  if (!Array.isArray(newPrompts)) {
    throw new Error("API response is not a JSON array.");
  }

  if (newPrompts.length !== DAYS_TO_GENERATE) {
    console.warn(
      `Warning: expected ${DAYS_TO_GENERATE} prompts but got ${newPrompts.length}. Using what we got.`
    );
  }

  // 5. Validate and attach gameId / number to each prompt
  const finalNewPrompts = newPrompts.map((raw, i) => {
    validatePrompt(raw, i);
    return {
      gameId: schedule[i]?.gameId ?? addDays(startDate, i),
      number: schedule[i]?.number ?? startNumber + i,
      prompt: raw.prompt,
      rows: raw.rows,
    };
  });

  console.log(`Validated ${finalNewPrompts.length} new prompt(s).`);

  // 6. Merge and write back
  const merged = [...existingPrompts, ...finalNewPrompts];
  await writeFile(PROMPTS_FILE, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  console.log(
    `Done! prompts.json now contains ${merged.length} total prompt(s).`
  );
  console.log(
    `Date range of new prompts: ${finalNewPrompts[0].gameId} to ${finalNewPrompts[finalNewPrompts.length - 1].gameId}`
  );
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
