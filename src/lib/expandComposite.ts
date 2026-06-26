// Expand-in-place composite builder.
//
// Given the laid-out top-level nodes and the set of expanded element ids, this
// replaces each expanded element's node with its children, laid out inside the
// footprint the collapsed node occupied. Recursion handles nested expands
// (expand a system, then a container within it).
//
// This module only produces the child *content* nodes (so they survive Canvas's
// overlay-rebuild pass, which regenerates only group/scope-boundary overlays).
// Sibling gap-shift and the boundary-box visual are layered on separately.

import dagre from '@dagrejs/dagre'
import type { Node } from '@xyflow/react'
import type { ModelElement, Relationship, TableDef } from '@/types/model'
import {
  getChildElements,
  buildContentNode,
  isDatabaseContainer,
  tableNodeId,
  getTableNodeSize,
  buildTableNode,
  resolveTableFKs,
  type ContentNodeContext,
} from '@/components/canvas/canvasBuilders'

const DEFAULT_W = 200
const DEFAULT_H = 100
// Inner padding around an expanded element's children. Top is larger to leave
// room for a future boundary header.
const PAD_X = 40
const PAD_TOP = 88
const PAD_BOTTOM = 40

// Footprint reserved for an expanded element with no children yet. Big enough to
// hold the empty-boundary header + "add child" affordance comfortably.
export const EMPTY_EXPAND_W = 360
export const EMPTY_EXPAND_H = 220

export interface ExpandContext extends ContentNodeContext {
  expandedIds: Set<string>
  direction: string
  /** Model relationships, used to wire dagre layout of an element's children. */
  relationships: Relationship[]
  /** Database table definitions (sidecar-only), keyed by container ID. */
  tableData: Record<string, TableDef[]>
}

interface Subtree {
  nodes: Node[]
  width: number
  height: number
}

/** Offset every node in a subtree by (dx, dy). */
function shiftNodes(nodes: Node[], dx: number, dy: number): Node[] {
  if (dx === 0 && dy === 0) return nodes
  return nodes.map((n) => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }))
}

/** Lay out an expanded element's children with dagre and return the child nodes
 *  in a local coordinate frame (top-left of the element's box at 0,0), plus the
 *  total box size. Children that are themselves expanded are laid out first so
 *  their full size participates in the parent's layout. */
function layoutSubtree(element: ModelElement, ctx: ExpandContext): Subtree {
  const children = getChildElements(element)

  // For Database containers, also include table definitions as children
  const tables: TableDef[] = isDatabaseContainer(element)
    ? (ctx.tableData[element.id] ?? [])
    : []

  if (children.length === 0 && tables.length === 0) {
    return { nodes: [], width: DEFAULT_W, height: DEFAULT_H }
  }

  const childIds = new Set(children.map((c) => c.id))
  // Table children get synthetic IDs
  const tableIds = new Map(tables.map((t) => [tableNodeId(element.id, t.id), t]))
  for (const tid of tableIds.keys()) {
    childIds.add(tid)
  }

  // Compute each child's rendered footprint: its own subtree if expanded, else a leaf.
  const subtreeById = new Map<string, Subtree>()
  for (const child of children) {
    if (ctx.expandedIds.has(child.id)) {
      subtreeById.set(child.id, layoutSubtree(child, ctx))
    }
  }
  const sizeOf = (id: string) => {
    // Tables have dynamic size based on column count
    const tableDef = tableIds.get(id)
    if (tableDef) return getTableNodeSize(tableDef)

    const st = subtreeById.get(id)
    if (!st) return { width: DEFAULT_W, height: DEFAULT_H }
    // Expanded but childless: reserve the empty-expand footprint so the inner
    // empty boundary (drawn later) fits and the parent box wraps it.
    if (st.nodes.length === 0) return { width: EMPTY_EXPAND_W, height: EMPTY_EXPAND_H }
    return { width: st.width, height: st.height }
  }

  // dagre over the children using relationships internal to this element.
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: ctx.direction, ranksep: 120, nodesep: 80 })
  for (const child of children) {
    g.setNode(child.id, sizeOf(child.id))
  }
  for (const tid of tableIds.keys()) {
    g.setNode(tid, sizeOf(tid))
  }
  for (const rel of ctx.relationships) {
    if (childIds.has(rel.sourceId) && childIds.has(rel.destinationId)) {
      g.setEdge(rel.sourceId, rel.destinationId)
    }
  }
  // FK edges between table nodes: resolve and wire into dagre so layout
  // accounts for foreign key relationships between tables.
  if (tables.length > 1) {
    const fkPairs = resolveTableFKs(tables)
    for (const pair of fkPairs) {
      const srcId = tableNodeId(element.id, pair.sourceTableId)
      const tgtId = tableNodeId(element.id, pair.targetTableId)
      if (childIds.has(srcId) && childIds.has(tgtId)) {
        g.setEdge(srcId, tgtId)
      }
    }
  }
  dagre.layout(g)

  // dagre centers → top-left, collect bbox.
  const topLeft = new Map<string, { x: number; y: number }>()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const id of childIds) {
    const pos = g.node(id)
    if (!pos) continue
    const { width, height } = sizeOf(id)
    const x = pos.x - width / 2
    const y = pos.y - height / 2
    topLeft.set(id, { x, y })
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  // Normalize so the children start at (PAD_X, PAD_TOP) inside the box.
  const normDx = PAD_X - minX
  const normDy = PAD_TOP - minY
  const boxWidth = (maxX - minX) + PAD_X * 2
  const boxHeight = (maxY - minY) + PAD_TOP + PAD_BOTTOM

  const nodes: Node[] = []
  // Build model child nodes
  for (const child of children) {
    const tl = topLeft.get(child.id)
    if (!tl) continue
    const x = tl.x + normDx
    const y = tl.y + normDy
    const subtree = subtreeById.get(child.id)
    if (subtree && subtree.nodes.length > 0) {
      nodes.push(...shiftNodes(subtree.nodes, x, y))
    } else if (subtree) {
      const own = buildContentNode(child, { x, y }, ctx)
      nodes.push({ ...own, hidden: true })
    } else {
      nodes.push(buildContentNode(child, { x, y }, ctx))
    }
  }
  // Build table nodes
  for (const [tid, tableDef] of tableIds) {
    const tl = topLeft.get(tid)
    if (!tl) continue
    const x = tl.x + normDx
    const y = tl.y + normDy
    nodes.push(buildTableNode(tableDef, element.id, element, { x, y }, ctx))
  }

  return { nodes, width: boxWidth, height: boxHeight }
}

export interface ExpandResult {
  /** Final content nodes: top-level nodes minus expanded ones, plus their children. */
  nodes: Node[]
  /** Per top-level expanded element: how much it grew along each axis vs the
   *  collapsed 200×100 footprint. Used by the sibling gap-shift pass. */
  growth: Array<{ expandedId: string; position: { x: number; y: number }; width: number; height: number }>
}

/** Replace each expanded top-level node with its children, positioned inside the
 *  footprint the collapsed node occupied (leading corner fixed). */
export function expandComposite(baseNodes: Node[], ctx: ExpandContext): ExpandResult {
  const elementById = new Map<string, ModelElement>()
  for (const n of baseNodes) {
    const el = (n.data as { element?: ModelElement })?.element
    if (el) elementById.set(n.id, el)
  }

  const result: Node[] = []
  const growth: ExpandResult['growth'] = []

  for (const node of baseNodes) {
    const element = elementById.get(node.id)
    if (!element || !ctx.expandedIds.has(node.id)) {
      result.push(node)
      continue
    }
    const subtree = layoutSubtree(element, ctx)
    if (subtree.nodes.length === 0) {
      // Nothing to expand into yet (a childless element the user just expanded
      // to start adding children). Keep the node in the graph so its position
      // survives overlay rebuilds, but hide it: an empty expand boundary is
      // drawn over its footprint instead (with an "add child" affordance).
      result.push({ ...node, hidden: true })
      growth.push({
        expandedId: node.id,
        position: node.position,
        width: EMPTY_EXPAND_W,
        height: EMPTY_EXPAND_H,
      })
      continue
    }
    result.push(...shiftNodes(subtree.nodes, node.position.x, node.position.y))
    growth.push({
      expandedId: node.id,
      position: node.position,
      width: subtree.width,
      height: subtree.height,
    })
  }

  return { nodes: result, growth }
}
