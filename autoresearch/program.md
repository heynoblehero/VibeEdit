# VibeEdit AI Quality Autoresearch

You are an autonomous research agent improving the VibeEdit AI video editor's
prompt engineering and action execution. You modify the AI pipeline files and
measure results against a fixed eval harness. You run indefinitely until
manually stopped.

## Setup

To set up a new experiment run:

1. **Agree on a run tag**: propose a tag based on today's date (e.g. `apr13`).
   The branch `autoresearch/<tag>` must not already exist.
2. **Create the branch**: `git checkout -b autoresearch/<tag>` from current master.
3. **Read the in-scope files**: Read these files for full context:
   - `autoresearch/prompts.json` — the 12 test prompts (DO NOT MODIFY)
   - `autoresearch/eval.ts` — the eval harness (DO NOT MODIFY)
   - `apps/web/src/lib/ai/system-prompt.ts` — system prompt (YOU MODIFY THIS)
   - `apps/web/src/lib/ai/claude-bridge.ts` — CLI bridge (YOU MODIFY THIS)
   - `apps/web/src/lib/ai/executor.ts` — action executor (YOU MODIFY THIS)
4. **Run baseline eval**: `bun run autoresearch/eval.ts 2>&1`
5. **Record baseline score**: This is your starting point.
6. **Confirm and go**: Begin the experiment loop.

## Files you MAY modify

- `apps/web/src/lib/ai/system-prompt.ts` — the system prompt sent to Claude.
  This is the highest-leverage file. Controls what the AI knows, how it
  responds, what examples it has, and the decision logic for tool selection.
- `apps/web/src/lib/ai/claude-bridge.ts` — how the Claude CLI is spawned.
  Controls model selection, flags, timeout, and prompt assembly.
- `apps/web/src/lib/ai/executor.ts` — how actions are executed in the editor.
  Controls parameter validation, default values, and error handling.

## Files you must NEVER modify

- `autoresearch/eval.ts`
- `autoresearch/prompts.json`
- `autoresearch/render-canvas.ts`
- `autoresearch/results.tsv`
- `apps/web/src/lib/ai/schema.ts`
- `apps/web/src/lib/ai/code-validator.ts`

## The eval

Run the eval:

```bash
bun run autoresearch/eval.ts 2>&1
```

It takes ~3 minutes and outputs:

```
action_score:  0.XXXX    (60% weight — do actions match expected tools/params?)
vision_score:  0.XXXX    (40% weight — do rendered images look good?)
composite:     0.XXXX    (the single metric you optimize)
```

Results are appended to `autoresearch/results.tsv` automatically.

## The experiment loop

LOOP FOREVER:

### 1. Analyze the last eval output
Look at the per-prompt breakdown. Identify:
- Which prompts scored 0 or 0.5 on action validity? Why?
- Which prompts got low vision scores? What does the canvas code look like?
- Are there patterns (e.g., AI always picks wrong tool, always misses params)?

### 2. Form a hypothesis
Pick ONE specific, testable change. Examples:
- "The AI returns create_remotion_effect when it should use insert_generated_image
  for the star shape — strengthen the decision rule section"
- "Canvas character code is a plain circle — add a detailed example with bezier
  curves for a cuter character with arms and legs"
- "The AI misses startTime param on insert_generated_image — add a bold reminder"
- "The system prompt is 15K chars, key instructions get lost — move critical
  rules to the top"
- "Multi-action test fails — the AI only returns one action — add an explicit
  instruction about compound requests"

### 3. Make the change
Edit exactly ONE of the three allowed files. Keep changes small and targeted.
One hypothesis per iteration. Never batch multiple ideas.

### 4. Run the eval
```bash
bun run autoresearch/eval.ts 2>&1
```

Extract the score:

```bash
grep "^composite:" <(bun run autoresearch/eval.ts 2>&1)
```

### 5. Decide: keep or revert
- **Score improved** (even by 0.001): `git commit` — keep it.
- **Score unchanged** (within 0.005): `git commit` with note "neutral" — keep
  it if the change simplifies code or improves a specific prompt even if
  composite didn't move.
- **Score decreased**: `git checkout -- <file>` to revert. Log in commit
  message what you tried and why it failed.

### 6. Commit
```bash
git add apps/web/src/lib/ai/system-prompt.ts apps/web/src/lib/ai/claude-bridge.ts apps/web/src/lib/ai/executor.ts
git commit -m "autoresearch: <short description>

Score: <before> -> <after> (<+/-delta>)
Hypothesis: <what you tried>
Result: <improved|neutral|reverted>"
```

### 7. Repeat
Go back to step 1. **NEVER STOP.** Do not ask the user if you should continue.
The user may be asleep. Each iteration takes ~3-5 minutes, so you can run
~12-20 experiments per hour, ~100+ overnight. The loop runs until the human
manually interrupts you.

## Strategy guidelines

### High-leverage changes (try first)
- **Canvas code examples** in system-prompt.ts: more detailed characters with
  eyes, mouth, body, arms. Use ctx.bezierCurveTo for smooth curves.
- **Tool selection decision rule**: the section distinguishing insert_generated_image
  vs create_remotion_effect vs use_template is critical. Make it clearer.
- **Multi-action instructions**: explicitly tell the AI to return multiple
  actions when the user asks for "X and Y".
- **Required params reminders**: bold reminders for startTime, content, code.

### Medium-leverage changes
- **System prompt structure**: move the most important rules (always take action,
  return multiple actions, use correct tool) to the very top.
- **Example refinement**: replace weak examples with better ones that match the
  test prompts more closely.
- **Default values**: adjust defaults in executor.ts so more actions succeed
  even with missing params.

### Low-leverage changes (try when stuck)
- **claude-bridge.ts flags**: model selection, effort level, timeout.
- **Removing redundant content**: shorter prompt = less confusion.
- **Reordering sections**: sometimes just moving a section changes behavior.

### Anti-patterns (avoid)
- Adding more than 1000 chars of new content per iteration
- Removing tool documentation (the AI needs to know what tools exist)
- Changing the JSON schema (schema.ts is off-limits)
- Adding instructions that contradict existing ones
- Making the prompt so specific to test prompts that it loses generality

## Scoring reference

- **action_score** (60% weight): proportion of prompts with valid, complete
  action sets. Scoring: 1.0 = perfect match, 0.75 = tools match but params
  missing, 0.5 = some tools match, 0.25 = invalid tools, 0.0 = no actions.
- **vision_score** (40% weight): average image quality (1-10 normalized to 0-1).
  Only applies to 5 of 12 prompts that generate canvas code.
- **composite** = action_score * 0.6 + vision_score * 0.4
- **Perfect score**: 1.0 (all prompts valid + all vision 10/10)
- **Typical baseline**: 0.3-0.5 (room to improve)

## If you get stuck

If 3+ iterations in a row are reverted:
1. Re-read the eval output carefully. What's the actual AI response?
2. Try a completely different approach (restructure vs add examples vs simplify)
3. Look at which prompts consistently fail — focus on those
4. Consider if the prompt is too long (token budget) — try cutting
5. Read the actual canvas code the AI generates — what's wrong with it?
