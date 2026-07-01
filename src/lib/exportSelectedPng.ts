import { getNodesBounds, getViewportForBounds, type Node, type Edge, type Rect } from '@xyflow/react'

// Copy selected nodes + the edges between them to the clipboard as a transparent
// PNG, by filtering the live `.react-flow__viewport` (not an off-screen clone).
// Matches Excalidraw's export: tight crop + 1x/2x/3x scale. See docs/export-png.md.

const OVERLAY_NODE_TYPES = new Set(['group', 'boundary'])
const EXPORT_PADDING = 10 // px, matches Excalidraw's default export padding

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
 * The user-selectable export scale (Excalidraw's 1x/2x/3x). Maps to pixelRatio.
 */
export type ExportScale = 1 | 2 | 3

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
  scale: ExportScale = 1,
  computeBounds: (nodes: Node[]) => Rect = getNodesBounds,
): Promise<Blob | null> {
  const keepNodeIds = selectExportNodeIds(nodes, selectedIds)
  if (keepNodeIds.size === 0) return null
  const keepEdgeIds = selectExportEdgeIds(edges, keepNodeIds)

  const bounds = computeBounds(nodes.filter((n) => keepNodeIds.has(n.id)))
  const width = Math.ceil(bounds.width) + EXPORT_PADDING * 2
  const height = Math.ceil(bounds.height) + EXPORT_PADDING * 2
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, 1, 1, 0)

  // Multiply by devicePixelRatio: a bare pixelRatio of 1 would render at CSS
  // pixels and look blurry on a HiDPI/Retina screen. This keeps 1× screen-crisp.
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1

  try {
    const { toBlob } = await import('html-to-image')
    return await toBlob(viewportEl, {
      width,
      height,
      pixelRatio: scale * dpr,
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

/**
 * Copy the selection to the clipboard as a PNG. Returns false when there is
 * nothing to export or the clipboard write fails.
 */
export async function copySelectedAsPng(
  viewportEl: HTMLElement,
  nodes: readonly Node[],
  edges: readonly Edge[],
  selectedIds: readonly string[],
  scale: ExportScale = 1,
  computeBounds: (nodes: Node[]) => Rect = getNodesBounds,
): Promise<boolean> {
  try {
    const blob = await exportSelectedAsPng(viewportEl, nodes, edges, selectedIds, scale, computeBounds)
    if (!blob) return false
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
