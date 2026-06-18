# changeState notation — build plan

Context doc for AI-assisted development. Keep this current as the feature lands.

**changeState** = a thing's state within the change you're showing. Distinct from `status`
(Live/Planned/Deprecated) and `location` (Internal/External).
Both elements and relationships share one value set: `existing` / `new` / `updated`.

Values + colors follow the owner's legend (`image #5`), extended symmetrically (the legend
showed only existing/new for systems; `updated` element added as green to match the updated
interaction):

| Target | existing | new | updated |
|---|---|---|---|
| Element fill | grey `#808080` | blue `#29ABE2` | green `#41ad49` |
| Relationship line | black `#1a1a1a` | blue `#29ABE2` | green `#41ad49` |

`new`=blue and `updated`=green everywhere; only `existing` differs (grey fill vs black line —
fill vs stroke). Hex approximated from the legend image — tune in stage 0.

## Problem

When modeling a change ("what's new vs what already exists"), the model can't say so.
Today the only way to mark a thing as `new` / `updated` / `existing` is to hand-add a
Structurizr **tag** and a matching style (see `docs/expand-in-place-plan.md`, scope note).
Tagging is an append-style chore in the tag manager — wrong feel for a core property.
Worse, a bare tag does nothing visually until you also define a style for it
(`getElementStyle`, canvasBuilders.ts:44-47), so "add a tag" appears to do nothing.

The author wants to *select* the state from a dropdown, like picking status, and have the
standard color applied automatically so any reader understands the diagram from the shared
legend — no manual styling.

Goal: changeState is a **first-class characteristic**, set from the inspector, auto-colored.
Internal/external stays exactly as-is.

## Scope (locked)

- **Build:** a `changeState` dropdown in the inspector (`src/components/layout/RightPanel.tsx`)
  beside status/location — `existing`/`new`/`updated` for both elements and relationships.
  Auto-applies the legend color in the renderer.
- **Keep untouched:** `location` (Internal / External). Native Structurizr
  (`Location` in `src/types/model.ts:3`, parsed in `src/lib/dsl/parser-model.ts`,
  rendered via `getElementStyle` in `src/components/canvas/canvasBuilders.ts:69`). No change.
- **Do NOT build:** a migration. Unset changeState = ignored, renders exactly as today.
  Old `.dsl` files are unaffected (additive, no forced change).
- **Do NOT remove:** the existing tag-based change-coloring path; changeState rides on top of it.

## Key decisions (and why)

- **Additive, "absent = no effect."** No changeState set → no color, normal render. Only an
  explicit choice paints. No default backfill, no migration.
  Why: existing diagrams must look identical after this ships (see
  `feedback_additive-no-migration` — preserve what users are used to).
- **Orthogonal to location.** An element can be `external` + `new`. Independent selectors.
- **UX = dropdown, not the tag manager.** Author selects the state like setting status.
- **STORAGE = reserved tag + built-in styles (LOCKED).** changeState is stored as a reserved tag
  (`existing` / `new` / `updated`) in the existing `tags: string[]`
  (`src/types/model.ts:15,63`) — the SAME array the tag manager and style cascade already use.
  c4hero **ships built-in styles** for these tags (element + relationship styles for
  `existing`/`new`/`updated`), so the dropdown colors instantly with no manual style step. Round-trips as plain Structurizr; other tools see the tags and can color
  them too (cross-tool parity — the legend is the shared standard).
  - Why not a private `properties` note: Structurizr styles off **tags**, not properties, so a
    note would only color inside c4hero. Tags reuse the proven
    `getElementStyle` / `getRelationshipStyle` cascade.
- **Reserved-tag guard (LOCKED).** The reserved tags are owned by the dropdown and hidden from
  the manual tag manager, so the two surfaces never fight (no double-add, no hand-delete).
- **Mutually exclusive (LOCKED).** A thing has at most one changeState tag; setting one clears
  any prior; choosing "none" removes it (leaving no residue).

## Staged plan (each stage = one commit = rollback checkpoint)

0. Branch + baseline. Lock exact hex for grey / blue / black / green from the legend.
1. Built-in styles: ship element + relationship styles for `existing`/`new`/`updated` (the
   reserved tags), so they paint out of the box. Round-trip test (styles serialize cleanly;
   unset things add no tags).
2. Reserved-tag plumbing (`src/store/slices/`): helpers to set/clear the single
   mutually-exclusive changeState tag on an element's or relationship's `tags` array. No model
   shape change. Unit test: setting `new` removes a prior changeState tag; clearing leaves none.
3. Inspector dropdown in `RightPanel.tsx` (existing/new/updated/none for both elements and
   relationships), writing via the slice. Mirrors the status selector.
4. Tag-manager guard: hide/lock the reserved tags in `TagManagerDialog.tsx` so the dropdown is
   their only editor.
5. Docs: add the convention to `docs/CAPABILITIES.md` once shipped.

Ordered so each stage stands alone; stuck at N → reset to N-1.

## Tests

- **Round-trip (unit):** a thing with changeState survives parse → serialize → parse; a thing
  WITHOUT it serializes identically to today (no new tags/keys leak). [core — no migration]
- **Renderer (unit/E2E):** element `new` → blue fill, `updated` → green, `existing` → grey;
  relationship `new` → blue line, `updated` → green, `existing` → black; unset is unchanged vs
  baseline. [core]
- **Inspector (E2E):** select a thing → dropdown sets changeState → recolors; "none" → normal.
- **Mutual exclusion:** setting `new` after `existing` leaves only `new`.
- **Orthogonality:** external + new shows both the external treatment and the new color.

## Open items (not yet decided)

- Exact hex values (fixed for v1; theme-aware deferred).
- Cascade order when a user's own manual tag style also targets the same thing
  (`getElementStyle` applies tags in order; reserved-tag style position matters).

## Progress log

### 2026-06-18 — requirement + colors locked, spec ready

- Term: **changeState**. Both elements and relationships: `existing`/`new`/`updated`.
  ("updated", not "modified", per the owner's legend.)
- Colors locked to the owner's legend (extended symmetrically): element existing=grey, new=blue,
  updated=green; relationship existing=black, new=blue, updated=green. Hex approximated, tune in
  stage 0.
- Storage LOCKED: reserved tags in the existing `tags` array + c4hero-shipped built-in styles,
  mutually exclusive, guarded from the tag manager. Additive, unset = ignored, no migration.
- Ready to build from stage 0. Only blank: exact hex.
