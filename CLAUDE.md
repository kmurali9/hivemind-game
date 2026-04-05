# Hivemind — Project Rules

## What this is
A daily puzzle game (like Wordle) where players pick one item from each row and score points based on how popular their picks are. Live at https://kmurali9.github.io/hivemind-game/

## Content rules
- **Family friendly** — all prompts, categories, and items must be appropriate for all ages. No sexual, explicit, or drug-related content. Think NYT Games audience.
- **Be FUNNY** — every prompt should make someone laugh or say "ooh that's a good one." Irreverent, opinionated, meme-aware. Not corporate or generic.
- **Keep items short** — under ~20 characters so they fit in the grid cells on mobile.

## Timeliness and cultural relevance
- **This is critical.** Prompts should feel like they were written TODAY, not 6 months ago.
- **Tie into what's happening in the real world** — big movie/TV releases (new Game of Thrones season, Marvel movie opening weekend), sports moments (NBA Finals, Super Bowl week, March Madness), award shows, viral moments, holidays, seasonal events.
- **When generating prompts, search the web** for what's coming up in that date range — premieres, playoffs, album drops, cultural events — and weave them in. At least 2-3 prompts per week should be tied to something timely.
- **Examples of great timely prompts:**
  - NBA Finals week: "Draft Your All-Time Starting Five"
  - New season of a hit show drops: "Cast Your Dream [Show] Alliance"
  - Summer kicks off: "Build Your Perfect Beach Day Cooler"
  - Oscar week: "Build Your Snub Revenge Ballot"
- **Evergreen prompts are fine for filler** (food debates, workplace humor, etc.) but the magic is in the timely ones.

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
- **NEVER edit prompts for dates that have already been played.** Firebase stores column indices (0-4), not item names. Changing items at a position breaks results display for everyone who already played. Only edit prompts with future gameId dates.
- Item ordering matters: $5 (index 0) should be the most desirable/popular option, $1 (index 4) the least. This creates the budget tension that makes the game fun.

## User preferences
- Krishna is not an engineer — do the work, don't explain how to do it.
- Keep explanations simple and jargon-free.
- Always push and deploy after making changes.
- When in doubt, ask before making big changes.
