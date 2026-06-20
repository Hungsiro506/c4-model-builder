import type { ElementStyle, RelationshipStyle } from '@/types/model'

/**
 * Change — a thing's state in a change diagram, following the TOGAF/ArchiMate
 * gap-analysis vocabulary (Baseline → Target): what's New, Modified, Unchanged,
 * or Removed. Orthogonal to `status` (Live/Planned/Deprecated) and `location`
 * (Internal/External). Applies to both elements and relationships.
 *
 * Stored as a reserved, mutually-exclusive **tag** in the existing `tags` array
 * (Title-Case, Structurizr tag convention) so it round-trips as plain
 * Structurizr. The colours below ship built-in and apply at render time only —
 * never serialized (see `changestate-roundtrip.test.ts`).
 */
export type ChangeState = 'New' | 'Modified' | 'Unchanged' | 'Removed'

/** The reserved change tags, in change-lifecycle order. Also the display order
 *  of the inspector control + the create-palette chips. */
export const CHANGE_STATES = ['New', 'Modified', 'Unchanged', 'Removed'] as const

const CHANGE_STATE_SET = new Set<string>(CHANGE_STATES)

/** True when `tag` is one of the reserved change tags. Used by the tag-manager /
 *  filter guards so the dropdown stays the sole editor. */
export function isChangeStateTag(tag: string): boolean {
  return CHANGE_STATE_SET.has(tag)
}

/**
 * Traffic-light change colours — the universally recognized diff/gap-analysis
 * convention (green=added, amber=changed, grey=same, red=removed), tuned to read
 * on the dark canvas. Element gets fill + stroke + text (+ reduced opacity for
 * Removed); relationship gets a line colour (+ dashed for Removed as a
 * non-colour cue). Render-only, so the shades are free to tune.
 *
 * `element` / `relationship` also double as the legend-dot colour in the
 * inspector control.
 */
export const CHANGESTATE_COLORS: Record<ChangeState, {
  element: string
  elementStroke: string
  elementText: string
  elementOpacity?: number
  relationship: string
  relationshipDashed?: boolean
}> = {
  New: { element: '#2f8a40', elementStroke: '#57b86a', elementText: '#eafaec', relationship: '#57b86a' },
  Modified: { element: '#8a5e12', elementStroke: '#e0a83a', elementText: '#faf0dc', relationship: '#e0a83a' },
  Unchanged: { element: '#3a4250', elementStroke: '#5b6472', elementText: '#d4dae3', relationship: '#6b7280' },
  Removed: { element: '#7a2e2e', elementStroke: '#c25555', elementText: '#fbe4e4', elementOpacity: 65, relationship: '#c25555', relationshipDashed: true },
}

/** Built-in element styles for the reserved tags — layered as a render-time base
 *  so a tagged element paints instantly, with no manual style step. */
export const CHANGESTATE_ELEMENT_STYLES: ElementStyle[] = CHANGE_STATES.map((state) => {
  const c = CHANGESTATE_COLORS[state]
  return {
    tag: state,
    background: c.element,
    stroke: c.elementStroke,
    color: c.elementText,
    ...(c.elementOpacity != null ? { opacity: c.elementOpacity } : {}),
  }
})

/** Built-in relationship styles for the reserved tags (line colour; Removed is
 *  dashed). */
export const CHANGESTATE_RELATIONSHIP_STYLES: RelationshipStyle[] = CHANGE_STATES.map((state) => {
  const c = CHANGESTATE_COLORS[state]
  return {
    tag: state,
    color: c.relationship,
    ...(c.relationshipDashed ? { dashed: true } : {}),
  }
})

/**
 * The change state currently set on a tag list, or `undefined` if none. If more
 * than one reserved tag is present (e.g. a hand-authored DSL import), the last
 * one wins — matching the renderer's last-tag-wins cascade.
 */
export function changeStateOf(tags: readonly string[]): ChangeState | undefined {
  let found: ChangeState | undefined
  for (const tag of tags) {
    if (CHANGE_STATE_SET.has(tag)) found = tag as ChangeState
  }
  return found
}

/**
 * Return a new tags array with the change state set to `next` (or cleared when
 * `next` is undefined). Mutually exclusive: any prior change tag is removed
 * first, so the result holds at most one. The new tag is appended (normal-tag
 * position — last in array, so it wins the cascade), never duplicated.
 * Non-change tags keep their order.
 */
export function withChangeState(tags: readonly string[], next: ChangeState | undefined): string[] {
  const withoutChangeState = tags.filter((tag) => !CHANGE_STATE_SET.has(tag))
  return next ? [...withoutChangeState, next] : withoutChangeState
}
