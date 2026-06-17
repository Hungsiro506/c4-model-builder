import type { Workspace } from '@/types/model'
import { findElementHelper } from '@/store/workspace-helpers'
import { EXPAND_BOUNDARY_PREFIX } from '@/components/canvas/canvasBuilders'

/** C4 hierarchy level of an element by its type. People and software systems
 *  sit at the top (0); containers nest one level down (1); components two (2).
 *  Relationships are only meaningful between elements at the same level — a
 *  container↔system edge has no clean place to land and breaks the canvas. */
export function elementLevel(type: string): number {
  switch (type) {
    case 'container':
      return 1
    case 'component':
      return 2
    // person, softwareSystem, deploymentNode, etc. → top level
    default:
      return 0
  }
}

/** A React Flow node id may be an expand-boundary wrapper (`__expand_boundary__<id>`).
 *  Strip the prefix to recover the underlying model element id. */
function modelIdOf(nodeId: string): string {
  return nodeId.startsWith(EXPAND_BOUNDARY_PREFIX)
    ? nodeId.slice(EXPAND_BOUNDARY_PREFIX.length)
    : nodeId
}

/**
 * Whether a relationship may be drawn between two canvas endpoints. Endpoints
 * must resolve to real model elements at the *same* C4 level. This blocks
 * cross-level connections (e.g. a container shown via expand-in-place dragged
 * to a top-level system) cleanly, instead of letting an unroutable edge
 * scramble the layout.
 */
export function canConnectElements(
  workspace: Workspace | null | undefined,
  sourceNodeId: string | null | undefined,
  targetNodeId: string | null | undefined,
): boolean {
  if (!workspace || !sourceNodeId || !targetNodeId) return false
  const sourceId = modelIdOf(sourceNodeId)
  const targetId = modelIdOf(targetNodeId)
  if (sourceId === targetId) return false

  const src = findElementHelper(workspace, sourceId)
  const tgt = findElementHelper(workspace, targetId)
  if (!src || !tgt) return false

  return elementLevel(src.type) === elementLevel(tgt.type)
}
