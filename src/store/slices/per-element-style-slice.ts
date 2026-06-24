import type { StateCreator } from 'zustand'
import type { WorkspaceState } from '../workspace-types'

/** Per-element and per-relationship visual overrides stored in the Zustand state
 *  (not in the workspace model) so they persist in the sidecar without polluting
 *  the DSL. Applied on top of the tag cascade at render time. */
export type PerElementStyleSlice = Pick<WorkspaceState,
  | 'elementStyles' | 'relationshipStyles'
  | 'setElementStyle' | 'clearElementStyle'
  | 'setRelationshipStyle' | 'clearRelationshipStyle'
  | 'replaceAllElementStyles' | 'replaceAllRelationshipStyles'
>

export const createPerElementStyleSlice: StateCreator<
  WorkspaceState,
  [['zustand/immer', never]],
  [],
  PerElementStyleSlice
> = (set) => ({
  elementStyles: {},
  relationshipStyles: {},

  setElementStyle: (elementId, style) => set((s) => {
    const existing = s.elementStyles[elementId] ?? {}
    const merged = { ...existing, ...style }
    // Remove keys that were explicitly cleared (set to undefined)
    if (style.background === undefined) delete merged.background
    if (style.color === undefined) delete merged.color
    // Drop the entry entirely if no overrides remain
    if (!merged.background && !merged.color) {
      delete s.elementStyles[elementId]
    } else {
      s.elementStyles[elementId] = merged
    }
  }),

  clearElementStyle: (elementId) => set((s) => {
    delete s.elementStyles[elementId]
  }),

  setRelationshipStyle: (relationshipId, style) => set((s) => {
    if (style.color) {
      s.relationshipStyles[relationshipId] = { color: style.color }
    } else {
      delete s.relationshipStyles[relationshipId]
    }
  }),

  clearRelationshipStyle: (relationshipId) => set((s) => {
    delete s.relationshipStyles[relationshipId]
  }),

  /** Bulk-replace element styles (used on workspace load to seed from sidecar). */
  replaceAllElementStyles: (styles) => set((s) => {
    s.elementStyles = styles
  }),

  /** Bulk-replace relationship styles (used on workspace load to seed from sidecar). */
  replaceAllRelationshipStyles: (styles) => set((s) => {
    s.relationshipStyles = styles
  }),
})
