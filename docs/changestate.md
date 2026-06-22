# Change state (change diagrams) — feature doc

Context doc for AI-assisted development. Records what was built and **why**. Keep current as the feature changes.

## Problem

When modelling a change ("what's new vs what already exists vs what's going away"), the model couldn't say so. The only way to mark a thing as new/changed/etc. was to hand-add a Structurizr **tag** *and* a matching style — an append-style chore, and a bare tag did nothing visually until a style was also defined. Authors wanted to pick the state like picking `status`, and have the standard colour applied automatically so any reader understands the diagram.

Goal: change state is a **first-class characteristic**, set from the UI, auto-coloured. Applies to **elements and relationships**.

## Scope (locked)

- **Build:** a `Change` control in the inspector (elements + relationships) and one-click **shortcut chips** in the "Create new" palette. Auto-applies the colour in the renderer.
- **Keep untouched:** `location` (Internal/External) and `status` (Live/Planned/…). Orthogonal axes.
- **Do NOT build:** a migration. Unset = ignored, renders exactly as today. Old `.dsl` files unaffected (additive).
- **No raw-file guard:** the `.dsl` is open text; hand-edits degrade gracefully (a missing/garbage change tag just means no colour). Guarding happens only in-app.

## Vocabulary + colours (and why)

- **Terminology = TOGAF/ArchiMate gap-analysis** (Baseline → Target): **New / Modified / Unchanged / Removed**. Chosen over invented words (the earlier draft used New/Existing/Updated) so readers meet familiar, standard terms. The UI label is **"Change"**.
  - Note: c4model.com deliberately prescribes **no** colours and has no change convention — "use whatever colours you like" — so the standard we follow here is the diff/gap convention, not C4.
- **Colours = traffic-light** (the universal diff convention), tuned for the **dark canvas** (the legend image was light-background; mid-grey/black read badly on dark):
  | State | Element fill | Stroke | Line (relationship) | Extra |
  |---|---|---|---|---|
  | New | `#2f8a40` green | `#57b86a` | `#57b86a` | |
  | Modified | `#8a5e12` amber | `#e0a83a` | `#e0a83a` | *amber shade still being tuned* |
  | Unchanged | `#3a4250` slate | `#5b6472` | `#6b7280` | |
  | Removed | `#7a2e2e` red | `#c25555` | `#c25555` | element opacity 65; **line dashed** |
- Removed uses a **non-colour cue** (dashed line) too — accessibility (colorblind/monochrome), which is the one thing C4 *does* ask for (consistency + accessibility).

## Key decisions (and why)

- **Storage = reserved tags in the existing `tags[]`** (`New`/`Modified`/`Unchanged`/`Removed`, Title-Case per Structurizr convention). Same array the tag manager + style cascade already use.
  - Why not a private `properties` note: Structurizr styles off **tags**, not properties, so a note would only colour inside c4hero. Tags reuse the proven `getElementStyle`/`getRelationshipStyle` cascade and other tools see them.
- **Render-only built-in styles (option 1, LOCKED).** The colours ship in code (`CHANGESTATE_*_STYLES`) and are layered at render time — **never serialized**. So files round-trip as plain Structurizr (tags only), unset things stay byte-identical, no migration. Cross-tool *colour* parity (writing the style block into the DSL) is a later, opt-in serializer toggle — no backend needed.
- **Relationships needed a new base-style layer.** Elements already layer theme styles under workspace styles (`buildElementStyleIndex`); relationships had no such seam — `getRelationshipStyle` read only workspace styles. Added `buildRelationshipStyleList()` so change line-colours paint out of the box.
- **Two entry points, one tag.** Inspector `Change` button-group (edit any element/rel) **and** palette shortcut chips (create a pre-marked system). Both write the same tag via `withChangeState`. Chips use `updateElementLive` so create+tag is a single undo step.
- **No auto-tagging.** New elements/edges start with no change state (opt-in). Keeps normal diagrams uncoloured.
- **No cascade special-case.** The change tag appends like a normal tag; standard last-in-array-wins applies. A clash only happens if the user deliberately colours another tag on the same element — rare, not worth special code.
- **Tag-guard via one predicate.** `isReservedTag()` (built-in type tags ∪ change tags) is the single source every surface consults — instead of the previous 3 hardcoded built-in lists. The `Change` control is the only in-app editor:
  - Tags tab: reserved tags render locked (no remove) and can't be hand-added.
  - Tag Manager: change tags hidden (their colours are render-only, so a row would be blank/uneditable).
  - Store `renameTag`/`removeTagGlobal`: no-op on reserved tags (safety net).
  - **Filtering still works** on change tags (useful: "show only New").

## Key files

- `src/lib/changeState.ts` — states, colours, `CHANGESTATE_ELEMENT_STYLES`/`_RELATIONSHIP_STYLES`, `changeStateOf`, `withChangeState`, `isChangeStateTag`.
- `src/components/canvas/canvasBuilders.ts` — `buildElementStyleIndex` (changeState layered in), `buildRelationshipStyleList`.
- `src/components/layout/RightPanel.tsx` — `ChangeStateField` button-group + Tags-tab guard.
- `src/components/layout/AddElementPanel.tsx` — "Changes" palette chips.
- `src/store/builtin-tags.ts` — `isReservedTag`.
- `src/store/slices/tag-style-slice.ts` — reserved-tag guards.
- `src/components/layout/highlighter/TagManagerDialog.tsx` — hides change tags.

## Tests (TDD)

- **Unit:** `changeState.test.ts` (states/colours/mutual-exclusion), `changestate-roundtrip.test.ts` (tag round-trips; render-only — no style block; unset = no leak), `builtin-tags.test.ts` (`isReservedTag`).
- **E2E (`e2e/change-state/`):** element colours/switch/clear; relationship line colour + dashed Removed; palette chips; tag-guard (Tags tab locked, Tag Manager hidden); orthogonality (external + New shows dashed + green); persist (auto-save carries the tag); undo/redo; default-no-change.
- Verified: 18 E2E + full unit suite green, typecheck + lint clean.

## Open items

- **Modified amber shade** — current `#8a5e12` reads muddy on dark; warm-orange `#a8611a` / gold `#9a6b0f` proposed, not yet chosen.
- **Cross-tool colour** — currently render-only (other tools see tags, not colours). A "export legend styles" toggle could serialize the style block if wanted.
- **Theme-aware colours** — single fixed dark-tuned palette for now; per-theme shades deferred.

## Progress log

### 2026-06-20 — feature shipped (branch `feat/changestate`, PR #4)

- Engine, element + relationship `Change` control, palette shortcut chips, render-only traffic-light colours, relationship base-style layer.
- Terminology pivoted draft New/Existing/Updated → standard **New/Modified/Unchanged/Removed**; label "Change".
- Colours retuned for the dark canvas (slate Unchanged, dashed/red Removed, deep fills); amber left as a follow-up.
- Tag-guard consolidated to `isReservedTag` across Tags tab, Tag Manager, store; change tags stay filterable.
- TDD throughout (one slip: inspector/relationship controls were coded before their E2E and locked after — relationship spec proven to bite by breaking the colour). Regression specs added for orthogonality, persist, undo/redo, default-no-change.
