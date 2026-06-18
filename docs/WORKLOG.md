# Worklog (temporary — delete later)

Scratch log of recent sessions. Not a permanent doc; remove once the work lands.

## 2026-06-18

### Capability map
- Wrote `docs/CAPABILITIES.md` — current functional inventory of c4hero (8 sections,
  `Capability | Where`). Pure "what exists today", no requirements/gaps/status.
- Sharpened the Styling & color rows: color is **tag-scoped only** (no per-element/per-edge),
  picker = hex/named/preset/clear (no spectrum/wheel).
- Gemini review (PR): use full `src/...` paths, not bare filenames. Applied across the whole
  doc, not just the 5 flagged lines.
- Merged via PR #3.

### changeState notation — requirement + spec
- New feature requirement worked out with the owner (priority #4 of the roadmap):
  mark a thing's state in a change diagram, first-class, not via the tag manager.
- Term chosen: **changeState** (self-documenting; no clash with `status`/`location`).
- Values: `existing` / `new` / `updated` for BOTH elements and relationships.
- Colors from the owner's legend, extended symmetrically:
  - element fill: existing=grey, new=blue, updated=green
  - relationship line: existing=black, new=blue, updated=green
- Storage decided: reserved tags in the existing `tags: string[]` + c4hero-shipped built-in
  styles (so the dropdown colors instantly). Round-trips as plain Structurizr; other tools see
  the tags. Mutually exclusive; guarded from the tag manager.
- Additive: unset = ignored, no migration, old `.dsl` files unchanged.
- Full plan: `docs/element-changestate-plan.md`. Not yet built — only exact hex left to tune.

### Misc
- Explained the scope popup ("internals for only one system"): it was a softwareSystem-scope
  validation; already removed on main in the expand-in-place merge.
- Pulled main up to date after PR #3 merge.
