# AEGIS parallel workflow — Inspector (finds) + Fixer (fixes)

Two agents work the same project at once, without either running out of tokens:

- **Inspector = your other CLI (Gemini).** Continuously inspects each component,
  finds problems, and writes them to `.autopilot/FINDINGS.md`. It does NOT fix.
- **Fixer = Claude (the live session).** Reads `FINDINGS.md`, fixes each problem,
  marks it `[FIXED]`, keeps the session alive so context isn't re-fed.

## Start the Inspector (in a SEPARATE terminal)

```bash
cd /Users/rahul2202/Downloads/Raise/aegis
gemini    # or: gemini -p "$(cat .autopilot/PROMPT.md)"
```
Paste the contents of `.autopilot/PROMPT.md` as the first message.

## The handoff file
`.autopilot/FINDINGS.md` is the shared board:
- Inspector appends `## [OPEN]` findings.
- Fixer resolves → `## [FIXED]`.
- Inspector re-checks → `## [VERIFIED]` (or `## [REOPEN]` with new evidence).

Watch it live:
```bash
tail -f .autopilot/FINDINGS.md
```

## Prerequisites (already running from the primary session)
- Keeper:  `cd keeper && npx wrangler dev --port 8787 --local`   (real backend)
- Vite:    `cd app && npm run dev`                               (localhost:5180)
Check: `curl -s localhost:8787/api/health` and `curl -s localhost:5180/`.
