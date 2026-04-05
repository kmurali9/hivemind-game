# Hivemind — Project Rules

## What this is
A daily puzzle game (like Wordle) where players pick one item from each row and score points based on how popular their picks are. Live at https://kmurali9.github.io/hivemind-game/

## Content rules
- **Family friendly** — all prompts, categories, and items must be appropriate for all ages. No sexual, explicit, or drug-related content. Think NYT Games audience.
- **Pop culture is great** — lean into memes, trending topics, funny debates, and cultural moments. Just keep it clean.
- **Keep items short** — under ~20 characters so they fit in the grid cells on mobile.

## Technical rules
- This is a single `index.html` file + `prompts.json`. Keep it that way — no build tools, no frameworks.
- Prompts load from `prompts.json` by today's date (Pacific Time). Never hardcode a prompt in index.html.
- Firebase handles auth (anonymous) and storing picks. Never expose or change the Firebase config without asking.
- Play restriction: one play per day per user (localStorage + Firebase). The `?admin=1` URL param bypasses this for testing.
- Always push to GitHub after changes — the site auto-deploys from the `main` branch.

## Prompt generation
- Prompts are pre-generated in bulk (currently 90 days through Jul 2, 2026).
- There is no auto-generation pipeline — when running low, generate more manually.
- Weekly preview email goes out Sundays at 9am PT showing Mon–Sun ahead.
- Low-stock alert emails on Mondays if under 2 weeks of prompts remain.

## User preferences
- Krishna is not an engineer — do the work, don't explain how to do it.
- Keep explanations simple and jargon-free.
- Always push and deploy after making changes.
- When in doubt, ask before making big changes.
