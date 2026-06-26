# VibeEdit — Asset Model & "Edit by Talking" Spec

> Status: design spec (2026-06-25). The data model behind VibeEdit's core loop:
> **video → text → reason → edits → video.** Every uploaded asset becomes text
> the AI can read; the project itself becomes a JSON the AI rewrites.

## 0. The unified model (decided 2026-06-25)

There is **ONE editor and ONE flow** — no separate persona system, no wizard, no
onboarding gate, no two doors.

```
New Project → set resolution + describe it → upload initial assets
   → AI creates the blank project, walks the assets, fills their JSON manifests
   → user starts chatting.
```

The upload surface is a **unified asset panel** with three *sources*:
- **Media** — upload files or `search_media`.
- **API keys** — BYOK (so generative steps work).
- **Characters** — a character is **just an asset kind, created inline here**:
  upload images, give it a name + nicknames, personality traits, how it should
  appear, sample scripts. No separate screen.

**The one rule that survives:** a character is a *channel brand* — the SAME
character must appear across MANY projects for months. So characters are
**created inline (project) but stored at account level** (`personas/<userId>/`,
which already exists), and the panel's **Characters source lists the ones you
already made** so you reuse (not re-upload) them in every new project. Reuse
lives inside the same uploader — still no separate page.

## 1. Principles

1. **The user only ever talks.** No timeline, no controls. Editing happens
   underneath the chat. The freedom lives in what they can *ask for*, not in a
   toolbar. (See `product-vision` memory.)
2. **The AI can't watch video — it reads manifests.** Each asset has a JSON
   sidecar. That sidecar IS how editing works.
3. **Names are handles.** A user-given (or AI-suggested) name on each asset is
   how the user points at a clip in chat — it replaces selecting with a mouse.
4. **The project is a document the AI rewrites.** Asset JSON = ingredients;
   project JSON (the EDL) = recipe; render = the build.
5. **Two layers per manifest: facts vs understanding.** Facts are cheap and
   captured on upload. Understanding is expensive, generated once, cached
   forever (re-run only if the file changes).
6. **Manifests are a queryable store, not a prompt dump.** Keep a one-line
   summary per asset in context; the AI pulls full manifests on demand.

## 2. Storage layout

Per-project, under `STORAGE_ROOT/projects/<userId>/<projectId>/`:

```
assets/
  beach-intro.mp4
  logo-sting.mp4
  .manifests/                # NEW — one JSON per asset, keyed by asset path
    beach-intro.mp4.json
    logo-sting.mp4.json
  processed/transcripts/     # EXISTING — cached Whisper output (reused as facts)
project.json                 # NEW — project edit-state (wraps the EDL) + chat-addressable
.assetmeta.json              # EXISTING — provenance (upload|ai); folded into manifest.source
```

Per-user persona store, under `STORAGE_ROOT/personas/<userId>/`:

```
persona.json                 # EXISTING — generalized below
base.png
poses/<label>.png            # EXISTING
```

> Manifests live in `assets/.manifests/` (dot-prefixed → already excluded from
> `listFiles()` by the `startsWith(".")` skip in `storage/fs.ts`), so they never
> show up as assets themselves. Mirrors how `.assetmeta.json` is hidden today.

## 3. Asset manifest schema

One file: `assets/.manifests/<assetPath>.json`. `facts` always present;
`understanding` populated lazily and cached.

```jsonc
{
  "version": 1,
  "path": "assets/beach-intro.mp4",     // canonical project-relative path
  "name": "beach-intro",                 // the chat handle (user-given or AI-suggested)
  "aliases": ["the intro", "opening shot"], // AI-maintained fuzzy handles
  "source": "upload",                    // upload | ai  (replaces .assetmeta.json)
  "kind": "video",                       // video | image | audio
  "addedAt": "2026-06-25T12:00:00Z",
  "contentHash": "sha256:…",             // invalidates `understanding` when file changes

  "facts": {                             // cheap, captured on upload via ffprobe
    "durationSeconds": 42.3,
    "width": 1920, "height": 1080, "fps": 30,
    "hasAlpha": false,
    "bytes": 18234123,
    "hasAudio": true
  },

  "understanding": {                     // expensive, generated once, then cached
    "summary": "Phone-shot beach walk, talking to camera about the trip.",
    "analyzedAt": "2026-06-25T12:01:30Z",

    // VIDEO/AUDIO with speech (from pack_footage / transcribe_clip):
    "transcript": [                      // word-level (Whisper); also stored at processed/transcripts/
      { "w": "So", "start": 0.12, "end": 0.31 }
    ],
    "transcriptText": "So this morning we …",
    "cuts": [                            // filler + dead-space candidates
      { "start": 3.1, "end": 3.7, "label": "filler: um" },
      { "start": 12.0, "end": 13.4, "label": "dead pause" }
    ],
    "keepSegments": [                    // EDL-ready (refine → render_edl)
      { "start": 0.0, "end": 3.1 }, { "start": 3.7, "end": 12.0 }
    ],
    "pacing": "talks fast; trim ~6s of dead air for a tighter cut",
    "keyMoments": [ { "t": 18.5, "note": "laughs / good reaction" } ],

    // IMAGE (vision model):
    "caption": "…", "tags": ["…"], "dominantColors": ["#1b3a5f"], "suggestedUse": "full-bleed bg",

    // AUDIO music/sfx:
    "audioType": "music",                // music | sfx | speech
    "mood": "upbeat", "bpm": 120
  },

  "usage": [                             // history → avoid repetition, learn prefs
    { "projectId": "…", "edit": "used 0–3.1s as hook", "at": "2026-06-25T12:05:00Z" }
  ]
}
```

**Rule:** if `contentHash` matches and `understanding.analyzedAt` exists, never
re-analyze. `understanding` regenerates only on hash change.

## 4. Persona schema (generalized)

`personas/<userId>/persona.json`. Extends today's shape (`name`, `description`,
`style`, `voiceId`, `poses[]`) with the "how it talks / personality" the founder
asked for, so the AI reads it to both *generate* and *write as* the character.

```jsonc
{
  "version": 1,
  "name": "Pixel",
  "kind": "persona",                     // a persona is a rich asset
  "description": "round blue robot mascot, big expressive eyes",  // visual identity
  "style": "flat vector, bold outlines",                          // art style (locked)
  "base": "base.png",
  "poses": [ { "label": "shocked", "file": "poses/shocked.png" } ],

  "voice": {                             // how it SOUNDS
    "voiceId": "…",                      // locked ElevenLabs voice
    "stability": 0.45, "style": 0.45
  },
  "personality": {                       // how it TALKS / who it is — AI writes scripts from this
    "traits": ["sarcastic", "nerdy", "warm"],
    "speakingStyle": "short punchy sentences, dry jokes, talks to camera",
    "catchphrases": ["…"],
    "doNots": ["no corporate filler"]
  },
  "sampleScripts": [ "…" ],              // a few generated at creation (founder's onboarding ask)
  "usage": [ { "projectId": "…", "at": "…" } ]
}
```

The agent reads `personality` + `voice` to keep every video sounding *authored
by the character*; edits in chat ("make Pixel angrier") rewrite this JSON and
regenerate affected poses.

## 5. Project edit-state schema

Wraps the **existing** `EditDecisionList` (`ffmpeg-tools.ts`) so the "edit by
talking" loop has a persisted, chat-addressable document. The EDL is the recipe;
this adds identity + revision history so "undo that," "make it tighter," "swap
those two" work conversationally.

```jsonc
{
  "version": 1,
  "projectId": "…",
  "mode": "edit",                        // edit (existing footage) | build (generated)
  "personaRef": "Pixel",                 // optional — persona used in this project

  "edl": {                               // EXISTING EditDecisionList shape, verbatim
    "version": 1,
    "segments": [                        // EdlSegment: source, start, end, beat?, grade?, speed?, audioLead/Trail?
      { "id": "s1", "source": "assets/beach-intro.mp4", "start": 0, "end": 3.1, "beat": "HOOK" }
    ],
    "overlays": [],                      // EdlOverlay: file, startInOutput, duration, x?, y?, width?
    "captions": [],                      // CaptionCue[] — applied last (Hard Rule 1)
    "outputPath": "renders/output.mp4",
    "loudnorm": true
  },

  "revisions": [                         // append-only — enables conversational undo
    { "at": "…", "intent": "remove filler", "summary": "cut 6 segments", "prevHash": "…" }
  ]
}
```

> Adds an `id` per segment (not in today's `EdlSegment`) so chat can address a
> specific cut ("drop s3"). `render_edl` already consumes `edl` as-is.

## 6. The one flow (project creation → chat)

```
0. CREATE     New Project: pick resolution + describe it (one screen)
1. UPLOAD     unified asset panel — sources: Media (upload/search) · API keys ·
              Characters (create inline OR reuse an account-level one)
2. NAME       user names each (or AI suggests); name = the chat handle
3. ANALYZE    AI walks the assets → facts (ffprobe) now; understanding
              (transcribe/scene/caption) lazily on first reference,
              cached to .manifests/ + processed/transcripts/
4. CHAT       user: "cut the boring parts of beach-intro and stick logo-sting on the end"
5. RESOLVE    AI maps handles → asset paths via name/aliases
6. REASON     AI reads the manifests (text), proposes an EDL diff, summarizes, STOPS
7. APPROVE    user confirms (or "no, keep the laugh at 0:18")
8. APPLY      write project.json (new revision), render_edl → output.mp4
9. ITERATE    "tighter" / "undo that" → AI rewrites the EDL from project.json
```

A "Build from scratch" project is the same flow with zero (or only character)
uploads — the AI generates the media instead of editing it. There is no separate
mode the user picks; it's just whether they brought footage.

## 7. Handle resolution

- Each manifest has `name` + AI-maintained `aliases`.
- On reference, AI resolves user phrasing → asset by name, then alias, then fuzzy
  (against `summary`/`caption`). Ambiguous → ask ("which clip — `beach-intro` or
  `beach-sunset`?"). This is the no-timeline selection mechanism; correctness here
  is the difference between magic and frustration.

## 8. Context strategy (scale)

- **Always in context:** a compact line per asset — `name · kind · duration ·
  one-line summary`. Cheap, lets the AI know what exists.
- **On demand:** AI calls a `read_manifest(name)` tool to pull the full JSON
  (transcript, cuts, etc.) only for assets it's actively editing.
- Never inline every transcript — a 30-clip library would blow the window.

## 9. Tools — have vs. need

| Capability | Status |
|---|---|
| Video → understanding (transcript, cuts, pacing, KEEP) | ✅ `pack_footage` (persist to manifest instead of `edit/*.pack.md`) |
| Transcript caching | ✅ `processed/transcripts/` |
| EDL build + render | ✅ `plan_footage_edit` / `render_edl` |
| Persona as asset | ✅ `persona.json` (extend with personality/voice/sampleScripts) |
| Provenance | ✅ `.assetmeta.json` (fold into `manifest.source`) |
| b-roll selection brain | ✅ `search_media` + plan scoring |
| **Per-asset manifest read/write** | ❌ NEW — `upsert_manifest`, `read_manifest`, `list_assets_summary` |
| **Manifest on upload (facts + suggest name)** | ❌ NEW — hook into upload route + ffprobe |
| **project.json (persisted EDL + revisions + undo)** | ❌ NEW — wrap existing EDL |
| **Image/audio understanding** | ❌ NEW — vision caption + audio classify |

## 10. Build order (proposed)

1. **Manifest core** — `manifest.json` read/write helpers in `storage/fs.ts`;
   facts on upload (ffprobe); `read_manifest` / `list_assets_summary` tools;
   context-summary injection. *Unlocks everything.*
2. **Wire pack_footage → manifest** — write `understanding` into the manifest
   (replace the `edit/*.pack.md` sink); lazy + cached.
3. **project.json + conversational undo** — persist the EDL with segment ids +
   revisions; "undo/tighter/swap" operate on it.
4. **Persona-as-asset** — extend `persona.json` with `personality`/`voice`/
   `sampleScripts`; created inline in the asset panel; stored account-level;
   "edit persona in chat" rewrites the JSON.
5. **Image/audio understanding** — vision captions, audio classify.
6. **Unified front door** — New Project (resolution + description) + the asset
   panel with Media / API keys / Characters sources (Characters lists reusable
   account-level ones). One flow, no separate persona page.
```
