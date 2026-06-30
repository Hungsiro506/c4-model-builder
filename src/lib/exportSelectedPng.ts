import { getNodesBounds, getViewportForBounds, type Node, type Edge, type Rect } from '@xyflow/react'
import { downloadBlob } from './exportUtils'

// Export selected nodes + the edges between them as a transparent PNG, by
// filtering the live `.react-flow__viewport` (not an off-screen clone).
// See docs/export-png.md.

const OVERLAY_NODE_TYPES = new Set(['group', 'boundary'])
const EXPORT_PADDING = 16

interface ExportNode {
  id: string
  type?: string
}
interface ExportEdge {
  id: string
  source: string
  target: string
}

/** Selected ids that are real content (overlays dropped even if selected). */
export function selectExportNodeIds(
  nodes: readonly ExportNode[],
  selectedIds: readonly string[],
): Set<string> {
  const selected = new Set(selectedIds)
  const keep = new Set<string>()
  for (const n of nodes) {
    if (selected.has(n.id) && !OVERLAY_NODE_TYPES.has(n.type ?? '')) keep.add(n.id)
  }
  return keep
}

/** Edges whose source and target are both exported. */
export function selectExportEdgeIds(
  edges: readonly ExportEdge[],
  exportNodeIds: ReadonlySet<string>,
): Set<string> {
  const keep = new Set<string>()
  for (const e of edges) {
    if (exportNodeIds.has(e.source) && exportNodeIds.has(e.target)) keep.add(e.id)
  }
  return keep
}

const CHROME_CLASSES = [
  'react-flow__background',
  'react-flow__minimap',
  'react-flow__controls',
  'react-flow__panel',
  'react-flow__attribution',
]

/** `html-to-image` predicate: false drops the element and its subtree. */
export function makeExportFilter(
  keepNodeIds: ReadonlySet<string>,
  keepEdgeIds: ReadonlySet<string>,
): (el: Element) => boolean {
  return (el: Element) => {
    const classList = el.classList
    if (!classList) return true
    for (const chrome of CHROME_CLASSES) {
      if (classList.contains(chrome)) return false
    }
    if (classList.contains('react-flow__node')) {
      const id = el.getAttribute('data-id')
      return id != null && keepNodeIds.has(id)
    }
    if (classList.contains('react-flow__edge')) {
      const id = el.getAttribute('data-id')
      return id != null && keepEdgeIds.has(id)
    }
    return true
  }
}

/**
 * Returns null when nothing exportable is selected. Callers with sub-flow nodes
 * (container children, `__table__*`) must pass `reactFlow.getNodesBounds` —
 * standalone `getNodesBounds` cannot resolve parent offsets.
 */
export async function exportSelectedAsPng(
  viewportEl: HTMLElement,
  nodes: readonly Node[],
  edges: readonly Edge[],
  selectedIds: readonly string[],
  computeBounds: (nodes: Node[]) => Rect = getNodesBounds,
): Promise<Blob | null> {
  const keepNodeIds = selectExportNodeIds(nodes, selectedIds)
  if (keepNodeIds.size === 0) return null
  const keepEdgeIds = selectExportEdgeIds(edges, keepNodeIds)

  const bounds = computeBounds(nodes.filter((n) => keepNodeIds.has(n.id)))
  const width = Math.ceil(bounds.width) + EXPORT_PADDING * 2
  const height = Math.ceil(bounds.height) + EXPORT_PADDING * 2
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, 1, 1, 0)

  try {
    const { toBlob } = await import('html-to-image')
    return await toBlob(viewportEl, {
      width,
      height,
      pixelRatio: 1,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      },
      filter: makeExportFilter(keepNodeIds, keepEdgeIds) as (el: HTMLElement) => boolean,
    })
  } catch {
    return null
  }
}

/** Export the selection and trigger a download; false when nothing to export. */
export async function downloadSelectedAsPng(
  viewportEl: HTMLElement,
  nodes: readonly Node[],
  edges: readonly Edge[],
  selectedIds: readonly string[],
  filename = 'selection.png',
  computeBounds: (nodes: Node[]) => Rect = getNodesBounds,
): Promise<boolean> {
  const blob = await exportSelectedAsPng(viewportEl, nodes, edges, selectedIds, computeBounds)
  if (!blob) return false
  downloadBlob(blob, filename)
  return true
}
