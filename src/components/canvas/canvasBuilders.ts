import type { Node, Edge, Connection } from '@xyflow/react'
import { isHighlighted, isHighlightedRel, highlightActive, type HighlightFilters } from '@/lib/highlight'
import { stripThemeManagedStyleFields } from '@/lib/themes'
import { buildElementMap, buildRelationshipMap } from '@/store/workspace'
import {
  expandedGroupElementIds,
  groupSpansBoundaryClusters,
  type LayoutBoundaryCluster,
} from '@/lib/canvasLayout'
import type { ModelElement, ElementStyle, RelationshipStyle, View, Workspace, Relationship, TableDef, FkEdgeDef, LineStyle } from '@/types/model'
import type { TableNodeData } from './nodes/TableNode'
import { EMPTY_EXPAND_W, EMPTY_EXPAND_H } from '@/lib/expandComposite'
import { CHANGESTATE_ELEMENT_STYLES, CHANGESTATE_RELATIONSHIP_STYLES } from '@/lib/changeState'

/** Build a tag → style index from the styles array (O(S) once, then O(1) lookups) */
function buildStyleIndex(styles: ElementStyle[]): Map<string, ElementStyle> {
  const map = new Map<string, ElementStyle>()
  for (const style of styles) {
    map.set(style.tag, { ...map.get(style.tag), ...style })
  }
  return map
}

/** Get the best matching style for an element based on its tags.
 *  Cascade order follows Structurizr: Element → type tag → custom tags (in order). */
function getElementStyle(
  element: ModelElement,
  styleIndex: Map<string, ElementStyle>,
): ElementStyle | undefined {
  const typeTag =
    element.type === 'person' ? 'Person'
    : element.type === 'softwareSystem' ? 'Software System'
    : element.type === 'container' ? 'Container'
    : 'Component'

  // 1. Start with the "Element" base tag (applies to all elements)
  let matched: ElementStyle | undefined
  const baseStyle = styleIndex.get('Element')
  if (baseStyle) matched = { ...baseStyle }

  // 2. Apply type tag style (Person, Software System, Container, Component)
  const typeStyle = styleIndex.get(typeTag)
  if (typeStyle) matched = { ...matched, ...typeStyle }

  // 3. Apply custom tags in order (later tags override earlier ones)
  for (const tag of element.tags) {
    if (tag === 'Element' || tag === typeTag) continue
    const tagStyle = styleIndex.get(tag)
    if (tagStyle) matched = { ...matched, ...tagStyle }
  }

  return matched
}

/** Get the best matching relationship style based on tags */
function getRelationshipStyle(
  tags: string[],
  styles: RelationshipStyle[],
): RelationshipStyle | undefined {
  let matched: RelationshipStyle | undefined
  for (const style of styles) {
    if (tags.includes(style.tag)) {
      matched = { ...matched, ...style }
    }
  }
  return matched
}

/** Get child count for drill-down hint. External systems are opaque and excluded. */
export function getChildCount(element: ModelElement): number | undefined {
  if (element.type === 'softwareSystem') {
    if (element.location === 'External') return undefined
    return element.containers.length
  }
  if (element.type === 'container') return element.components.length
  return undefined
}

/** Direct children of an element for expand-in-place: containers of a system,
 *  components of a container. People/components have none. */
export function getChildElements(element: ModelElement): ModelElement[] {
  if (element.type === 'softwareSystem') return element.containers
  if (element.type === 'container') return element.components
  return []
}

/** Build the tag→style index for a workspace (theme styles as base layer,
 *  custom workspace styles override). Exported so expand-in-place can color
 *  child nodes identically to the top-level pass. */
export function buildElementStyleIndex(
  workspace: Workspace,
  themeStyles: ElementStyle[],
): Map<string, ElementStyle> {
  const workspaceStyles = workspace.views.configuration.styles.elements
    .map(stripThemeManagedStyleFields)
    .filter((style): style is ElementStyle => style !== null)
  // changeState styles ship built-in (render-only, never serialized) so a
  // reserved tag paints instantly. Placed first so theme/workspace styles for
  // the same tag could still override, should a user ever customize one.
  return buildStyleIndex([...CHANGESTATE_ELEMENT_STYLES, ...themeStyles, ...workspaceStyles])
}

/** Relationship styles with the built-in changeState styles layered underneath
 *  (render-only, never serialized). Relationships have no theme layer, so this
 *  is the only built-in base. Workspace styles come last and override. */
export function buildRelationshipStyleList(workspace: Workspace): RelationshipStyle[] {
  return [...CHANGESTATE_RELATIONSHIP_STYLES, ...workspace.views.configuration.styles.relationships]
}

export interface ContentNodeContext {
  styleIndex: Map<string, ElementStyle>
  active: boolean
  filters: HighlightFilters
  drillableIds: Set<string>
  onDrillIn: (elementId: string) => void
  viewCountMap: Map<string, number>
}

/** Build a single React Flow content node for an element at a given position.
 *  Shared by buildNodes (top-level) and the expand-in-place composite builder
 *  so colors, drill hints, and highlight classes stay consistent. */
export function buildContentNode(
  element: ModelElement,
  position: { x: number; y: number },
  ctx: ContentNodeContext,
): Node {
  const style = getElementStyle(element, ctx.styleIndex)
  const highlighted = ctx.active && isHighlighted(element, ctx.filters)
  return {
    id: element.id,
    type: element.type,
    position,
    data: {
      element,
      style,
      childCount: getChildCount(element),
      canDrill: ctx.drillableIds.has(element.id),
      onDrillIn: ctx.onDrillIn,
      highlighted,
      viewCount: ctx.viewCountMap.get(element.id) ?? 1,
    },
    className: ctx.active ? (highlighted ? 'c4-node-highlighted' : 'c4-node-faded') : undefined,
  }
}

/** Pick the best source/target handle sides based on relative node positions.
 *  Uses center slot (b) by default. Handle ID format: {side}-{slot}-{type} */
function computeHandlePair(
  srcPos: { x: number; y: number },
  dstPos: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = dstPos.x - srcPos.x
  const dy = dstPos.y - srcPos.y

  // Use the dominant axis to pick sides, default to center slot (b)
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      return { sourceHandle: 'right-b-source', targetHandle: 'left-b-target' }
    } else {
      return { sourceHandle: 'left-b-source', targetHandle: 'right-b-target' }
    }
  } else {
    if (dy > 0) {
      return { sourceHandle: 'bottom-b-source', targetHandle: 'top-b-target' }
    } else {
      return { sourceHandle: 'top-b-source', targetHandle: 'bottom-b-target' }
    }
  }
}

/** Pre-compute the set of element IDs that can be drilled into (have a child view).
 *  O(V) once instead of O(N * (tree + V)) per element in buildNodes. */
export function buildDrillableSet(workspace: Workspace): Set<string> {
  const drillable = new Set<string>()
  for (const v of workspace.views.containerViews) {
    if (v.softwareSystemId) drillable.add(v.softwareSystemId)
  }
  for (const v of workspace.views.systemContextViews) {
    if (v.softwareSystemId) drillable.add(v.softwareSystemId)
  }
  for (const v of workspace.views.componentViews) {
    if (v.containerId) drillable.add(v.containerId)
  }
  return drillable
}

/** Return the same boundary memberships buildBoundaryNodes will draw. */
export function buildBoundaryLayoutClusters(workspace: Workspace, view: View): LayoutBoundaryCluster[] {
  const viewElementIds = new Set(view.elements.map((element) => element.id))
  const clusters: LayoutBoundaryCluster[] = []

  if (view.type === 'container') {
    for (const sys of workspace.model.softwareSystems) {
      const elementIds = sys.containers
        .map((container) => container.id)
        .filter((id) => viewElementIds.has(id))
      if (elementIds.length > 0) clusters.push({ id: sys.id, elementIds })
    }
  } else if (view.type === 'component') {
    for (const sys of workspace.model.softwareSystems) {
      for (const container of sys.containers) {
        const elementIds = container.components
          .map((component) => component.id)
          .filter((id) => viewElementIds.has(id))
        if (elementIds.length > 0) clusters.push({ id: container.id, elementIds })
      }
    }
  }

  return clusters
}

/** Build React Flow nodes from workspace view (no edges yet — those need final positions). */
export function buildNodes(
  workspace: Workspace,
  view: View,
  onDrillIn: (elementId: string) => void,
  filters: HighlightFilters,
  viewCountMap: Map<string, number>,
  drillableIds: Set<string>,
  themeStyles: ElementStyle[],
): Node[] {
  const elementMap = buildElementMap(workspace)
  // Theme styles form the base layer. Truly custom workspace styles still
  // override them, but colors copied from our bundled palettes stay
  // theme-managed so switching themes updates node fills consistently.
  const styleIndex = buildElementStyleIndex(workspace, themeStyles)

  const active = highlightActive(filters)
  const ctx: ContentNodeContext = { styleIndex, active, filters, drillableIds, onDrillIn, viewCountMap }
  const nodes: Node[] = []

  for (const viewEl of view.elements) {
    const element = elementMap.get(viewEl.id)
    if (!element) continue
    nodes.push(buildContentNode(element, { x: viewEl.x ?? 0, y: viewEl.y ?? 0 }, ctx))
  }

  return nodes
}

type OverlayRect = { x: number; y: number; w: number; h: number }
type ModelGroup = Workspace['model']['groups'][number]

function nodeRect(node: Node): OverlayRect {
  return {
    x: node.position.x,
    y: node.position.y,
    w: node.measured?.width ?? (Number(node.style?.width) || 200),
    h: node.measured?.height ?? (Number(node.style?.height) || 100),
  }
}

function groupIsNestedInside(
  child: ModelGroup,
  parent: ModelGroup,
): boolean {
  if (child.id === parent.id || child.elementIds.length >= parent.elementIds.length) return false
  const parentIds = new Set(parent.elementIds)
  return child.elementIds.every((id) => parentIds.has(id))
}

/** Build group background nodes using post-layout element positions. */
export function buildGroupNodes(
  workspace: Workspace,
  groups: typeof workspace.model.groups,
  laidOutNodes: Node[],
  boundaryClusters: LayoutBoundaryCluster[] = [],
): Node[] {
  const PADDING = 24
  const PADDING_TOP = 52 // extra room for the group label
  const BOUNDARY_SPANNING_PADDING = 72
  const BOUNDARY_SPANNING_PADDING_TOP = 132

  // Build position+size map from the already-laid-out element nodes
  const nodeMap = new Map<string, OverlayRect>()
  for (const n of laidOutNodes) {
    if (!n.id.startsWith('group-') && !n.id.startsWith('__scope_boundary__')) {
      nodeMap.set(n.id, nodeRect(n))
    }
  }

  const groupRectCache = new Map<string, OverlayRect | null>()
  const visiting = new Set<string>()

  const getGroupRect = (group: ModelGroup): OverlayRect | null => {
    if (groupRectCache.has(group.id)) return groupRectCache.get(group.id) ?? null
    if (visiting.has(group.id)) return null
    visiting.add(group.id)

    const presentIds = new Set(nodeMap.keys())
    const spansBoundaries = groupSpansBoundaryClusters(group.elementIds, boundaryClusters, presentIds)
    const visualElementIds = expandedGroupElementIds(group.elementIds, boundaryClusters, presentIds)
    const memberNodes = visualElementIds
      .map((id) => nodeMap.get(id))
      .filter((p): p is OverlayRect => p !== undefined)

    if (memberNodes.length < 2) {
      groupRectCache.set(group.id, null)
      visiting.delete(group.id)
      return null
    }

    const nestedGroups = groups
      .filter((candidate) => groupIsNestedInside(candidate, group))
      .map((candidate) => getGroupRect(candidate))
      .filter((p): p is OverlayRect => p !== null)

    const memberRects = [...memberNodes, ...nestedGroups]
    const minX = Math.min(...memberRects.map((p) => p.x))
    const minY = Math.min(...memberRects.map((p) => p.y))
    const maxX = Math.max(...memberRects.map((p) => p.x + p.w))
    const maxY = Math.max(...memberRects.map((p) => p.y + p.h))
    const padding = spansBoundaries ? BOUNDARY_SPANNING_PADDING : PADDING
    const paddingTop = spansBoundaries ? BOUNDARY_SPANNING_PADDING_TOP : PADDING_TOP
    const rect = {
      x: minX - padding,
      y: minY - paddingTop,
      w: (maxX - minX) + padding * 2,
      h: (maxY - minY) + paddingTop + padding,
    }

    groupRectCache.set(group.id, rect)
    visiting.delete(group.id)
    return rect
  }

  const groupNodes: Node[] = []
  for (const group of groups) {
    const rect = getGroupRect(group)
    if (!rect) continue

    groupNodes.push({
      id: `group-${group.id}`,
      type: 'group',
      position: { x: rect.x, y: rect.y },
      measured: { width: rect.w, height: rect.h },
      style: { width: rect.w, height: rect.h, backgroundColor: 'transparent', pointerEvents: 'auto' },
      data: { label: group.name, elementCount: group.elementIds.length },
      zIndex: -1,
      selectable: true,
      // Drag handler: Canvas's onNodeDragStart/onNodeDrag/onNodeDragStop
      // detect group drags (id starts with `group-`) and translate every
      // member by the same delta. The group's own position is then re-
      // derived from the updated members on the next overlay rebuild.
      draggable: true,
    })
  }
  return groupNodes
}

/** Build the implicit scope boundary node for container/component views using post-layout positions. */
/**
 * Build the C4 boundary boxes that wrap members of a parent (system or
 * container) on the active view. On a Container view we draw one boundary
 * per software system whose containers appear in the view (the focal system
 * AND any foreign systems whose containers were added via picker or via the
 * Structurizr `include element.parent==X` recipe). On a Component view we
 * do the same per container. Each boundary becomes a draggable overlay node
 * with id `__scope_boundary__<parentId>` and is rendered at z-index -2 so
 * its members sit on top. Boundaries are intentionally pointer-transparent so
 * canvas gestures and member-node drags work over the full boundary body.
 *
 * Foreign-system boundaries are essential for the multi-system container
 * view recipe — without them, foreign containers float in the view with no
 * visual indication of which system they belong to.
 */
export function buildBoundaryNodes(
  workspace: Workspace,
  view: View,
  laidOutNodes: Node[],
  groupNodes: Node[] = [],
): Node[] {
  const BOUNDARY_PADDING = 32
  // Header has 2 lines (name + type label) + internal padding; needs more
  // headroom than the side/bottom padding so the subtitle isn't covered by the
  // topmost member node.
  const BOUNDARY_PADDING_TOP = 64

  // Build position+size map from laid-out element nodes only
  const nodeMap = new Map<string, OverlayRect>()
  for (const n of laidOutNodes) {
    if (!n.id.startsWith('group-') && !n.id.startsWith('__scope_boundary__')) {
      nodeMap.set(n.id, nodeRect(n))
    }
  }

  const groupRectMap = new Map<string, OverlayRect>()
  for (const groupNode of groupNodes) {
    if (groupNode.id.startsWith('group-')) groupRectMap.set(groupNode.id.slice(6), nodeRect(groupNode))
  }

  // Empty-boundary defaults: when the focal scope has no members in the view
  // (a fresh L2/L3 the user just created), still draw a labeled boundary so
  // the user sees what the view is about. The first node added will land
  // inside the boundary and trigger an auto-resize on the next rebuild.
  const EMPTY_BOUNDARY_W = 400
  const EMPTY_BOUNDARY_H = 200

  function groupRectsInside(memberIds: Set<string>): OverlayRect[] {
    return workspace.model.groups
      .filter((group) => group.elementIds.length > 0 && group.elementIds.every((id) => memberIds.has(id)))
      .map((group) => groupRectMap.get(group.id))
      .filter((rect): rect is OverlayRect => rect !== undefined)
  }

  function makeBoundary(parentId: string, name: string, typeLabel: string, members: OverlayRect[]): Node {
    if (members.length === 0) {
      return {
        id: `__scope_boundary__${parentId}`,
        type: 'boundary',
        position: { x: 0, y: 0 },
        measured: { width: EMPTY_BOUNDARY_W, height: EMPTY_BOUNDARY_H },
        style: { width: EMPTY_BOUNDARY_W, height: EMPTY_BOUNDARY_H, pointerEvents: 'none' },
        data: { name, typeLabel, empty: true },
        zIndex: -2,
        selectable: false,
        draggable: false,
        focusable: false,
      }
    }
    const minX = Math.min(...members.map(p => p.x))
    const minY = Math.min(...members.map(p => p.y))
    const maxX = Math.max(...members.map(p => p.x + p.w))
    const maxY = Math.max(...members.map(p => p.y + p.h))
    return {
      id: `__scope_boundary__${parentId}`,
      type: 'boundary',
      position: { x: minX - BOUNDARY_PADDING, y: minY - BOUNDARY_PADDING_TOP },
      measured: {
        width: (maxX - minX) + BOUNDARY_PADDING * 2,
        height: (maxY - minY) + BOUNDARY_PADDING_TOP + BOUNDARY_PADDING,
      },
      style: {
        width: (maxX - minX) + BOUNDARY_PADDING * 2,
        height: (maxY - minY) + BOUNDARY_PADDING_TOP + BOUNDARY_PADDING,
        pointerEvents: 'none',
      },
      data: { name, typeLabel },
      zIndex: -2,
      selectable: false,
      draggable: false,
      focusable: false,
    }
  }

  const boundaries: Node[] = []

  if (view.type === 'container') {
    // Track which systems already got a boundary (because they have members)
    // so we don't double-emit when the focal system is also in the loop.
    const drawnSystemIds = new Set<string>()
    for (const sys of workspace.model.softwareSystems) {
      const members: OverlayRect[] = []
      const memberIds = new Set<string>()
      for (const c of sys.containers) {
        const pos = nodeMap.get(c.id)
        if (pos) {
          members.push(pos)
          memberIds.add(c.id)
        }
      }
      if (members.length > 0) {
        boundaries.push(makeBoundary(sys.id, sys.name, 'Software System', [...members, ...groupRectsInside(memberIds)]))
        drawnSystemIds.add(sys.id)
      }
    }
    // Always show the focal-system boundary, even when empty — the user just
    // created this Container view and needs to see what scope they're filling.
    if (view.softwareSystemId && !drawnSystemIds.has(view.softwareSystemId)) {
      const focal = workspace.model.softwareSystems.find(s => s.id === view.softwareSystemId)
      if (focal) {
        boundaries.push(makeBoundary(focal.id, focal.name, 'Software System', []))
      }
    }
  } else if (view.type === 'component') {
    const drawnContainerIds = new Set<string>()
    for (const sys of workspace.model.softwareSystems) {
      for (const c of sys.containers) {
        const members: OverlayRect[] = []
        const memberIds = new Set<string>()
        for (const comp of c.components) {
          const pos = nodeMap.get(comp.id)
          if (pos) {
            members.push(pos)
            memberIds.add(comp.id)
          }
        }
        if (members.length > 0) {
          boundaries.push(makeBoundary(c.id, c.name, 'Container', [...members, ...groupRectsInside(memberIds)]))
          drawnContainerIds.add(c.id)
        }
      }
    }
    if (view.containerId && !drawnContainerIds.has(view.containerId)) {
      const focal = workspace.model.softwareSystems
        .flatMap(s => s.containers)
        .find(c => c.id === view.containerId)
      if (focal) {
        boundaries.push(makeBoundary(focal.id, focal.name, 'Container', []))
      }
    }
  }

  return boundaries
}

/** Distribute multiple edges on the same side across 3 slots (a–c) */
const SLOTS = ['a', 'b', 'c'] as const

/**
 * Pick N slots from the 3 available, centered on b.
 * N=1→[b], N=2→[a,c], N=3→[a,b,c],
 * N>3→cycle through all 3.
 */
function pickSlots(n: number): string[] {
  if (n <= 0) return []
  const all = SLOTS as unknown as string[]
  if (n >= all.length) {
    // More edges than slots: assign all slots then cycle
    return Array.from({ length: n }, (_, i) => all[i % all.length])
  }
  const spread: Record<number, string[]> = {
    1: ['b'],
    2: ['a', 'c'],
  }
  return spread[n] ?? all
}

interface EdgeInfo {
  /** React Flow edge id. Defaults to the relationship id; composite edges that
   *  fan one relationship onto several visible endpoints get a suffixed id so
   *  React Flow keys stay unique. */
  edgeId: string
  relId: string
  sourceId: string
  targetId: string
  sourceSide: string
  targetSide: string
  relStyle: RelationshipStyle | undefined
  rel: Relationship
  /** When >1, this edge summarizes a bundle of finest relationships re-targeted
   *  onto the same visible source/target pair (expand-in-place). */
  bundleCount?: number
}

/** Compute the handle sides for an edge between two laid-out endpoints. */
function makeEdgeInfo(
  rel: Relationship,
  sourceId: string,
  targetId: string,
  posMap: Map<string, { x: number; y: number }>,
  relationshipStyles: RelationshipStyle[],
): EdgeInfo {
  const relStyle = getRelationshipStyle(rel.tags, relationshipStyles)
  const srcPos = posMap.get(sourceId)
  const dstPos = posMap.get(targetId)
  const handles = srcPos && dstPos
    ? computeHandlePair(srcPos, dstPos)
    : { sourceHandle: 'bottom-b-source', targetHandle: 'top-b-target' }
  return {
    edgeId: rel.id,
    relId: rel.id,
    sourceId,
    targetId,
    sourceSide: handles.sourceHandle.split('-')[0],
    targetSide: handles.targetHandle.split('-')[0],
    relStyle,
    rel,
  }
}

/** Assign non-overlapping handle slots and assemble final React Flow edges from
 *  pre-resolved EdgeInfos. Shared by buildEdges (view relationships) and
 *  buildCompositeEdges (expand-in-place re-targeted relationships). */
function assembleEdges(
  edgeInfos: EdgeInfo[],
  posMap: Map<string, { x: number; y: number }>,
  nodes: Node[],
  filters: HighlightFilters,
): Edge[] {
  // Second pass: count ALL edges per node+side (regardless of source/target direction),
  // then assign slots so edges sharing a side never overlap.
  const sideGroups = new Map<string, { edgeIndex: number; role: 'source' | 'target' }[]>()
  for (let i = 0; i < edgeInfos.length; i++) {
    const e = edgeInfos[i]
    const srcKey = `${e.sourceId}:${e.sourceSide}`
    const tgtKey = `${e.targetId}:${e.targetSide}`
    if (!sideGroups.has(srcKey)) sideGroups.set(srcKey, [])
    sideGroups.get(srcKey)!.push({ edgeIndex: i, role: 'source' })
    if (!sideGroups.has(tgtKey)) sideGroups.set(tgtKey, [])
    sideGroups.get(tgtKey)!.push({ edgeIndex: i, role: 'target' })
  }

  const sourceSlots = new Map<number, string>()
  const targetSlots = new Map<number, string>()

  for (const [key, entries] of sideGroups) {
    const side = key.split(':')[1]

    const sorted = [...entries].sort((a, b) => {
      const isHorizontalSide = side === 'top' || side === 'bottom'
      const nodeIdA = a.role === 'source' ? edgeInfos[a.edgeIndex].targetId : edgeInfos[a.edgeIndex].sourceId
      const nodeIdB = b.role === 'source' ? edgeInfos[b.edgeIndex].targetId : edgeInfos[b.edgeIndex].sourceId
      const posA = posMap.get(nodeIdA)
      const posB = posMap.get(nodeIdB)
      if (!posA || !posB) return 0
      return isHorizontalSide ? posA.x - posB.x : posA.y - posB.y
    })

    const chosen = pickSlots(sorted.length)
    for (let j = 0; j < sorted.length; j++) {
      const { edgeIndex, role } = sorted[j]
      const slotMap = role === 'source' ? sourceSlots : targetSlots
      slotMap.set(edgeIndex, chosen[j])
    }
  }

  // Build final edges with slot-assigned handles.
  // Highlight rules:
  //   - Tech filter active: edges that match the tech AND get the bright ring.
  //   - Any facet active: edges whose source or target is faded also fade so
  //     focus stays on the highlighted subgraph.
  const active = highlightActive(filters)
  const techActive = filters.techs.length > 0
  const highlightedNodeIds = new Set(nodes.filter((n) => (n.data as { highlighted?: boolean })?.highlighted).map((n) => n.id))
  const edges: Edge[] = []
  for (let i = 0; i < edgeInfos.length; i++) {
    const e = edgeInfos[i]
    const srcSlot = sourceSlots.get(i) ?? 'b'
    const tgtSlot = targetSlots.get(i) ?? 'b'

    const techHighlighted = techActive && isHighlightedRel(e.rel, filters)
    const endpointsHighlighted = highlightedNodeIds.has(e.sourceId) && highlightedNodeIds.has(e.targetId)
    const highlighted = techHighlighted || (active && endpointsHighlighted)
    const faded = active && !highlighted

    let className: string | undefined
    if (highlighted) className = 'c4-edge-highlighted'
    else if (faded) className = 'c4-edge-faded'

    edges.push({
      id: e.edgeId,
      source: e.sourceId,
      target: e.targetId,
      sourceHandle: `${e.sourceSide}-${srcSlot}-source`,
      targetHandle: `${e.targetSide}-${tgtSlot}-target`,
      type: 'relationship',
      data: { relationship: e.rel, relationshipStyle: e.relStyle, highlighted },
      className,
    })
  }

  return edges
}

/** Overlay-node id prefix for the box drawn around an expanded element's
 *  children (semantic zoom). Mirrors SCOPE_BOUNDARY_PREFIX in Canvas. */
export const EXPAND_BOUNDARY_PREFIX = '__expand_boundary__'

// Must match the inner padding expandComposite uses so the boundary box lines
// up with where the children were actually placed.
export const EB_PAD_X = 40
export const EB_PAD_TOP = 88
export const EB_PAD_BOTTOM = 40

/** Compute the wrapper rect for each expanded element from its rendered child
 *  content nodes (deepest-first so an outer box wraps the inner boxes, matching
 *  the boundary nodes drawn from these rects). This is the single source of truth
 *  for "how big is the expand wrapper" — both the rendered boundary nodes and the
 *  sibling-collision push read it, so the push can never disagree with what the
 *  user sees. Reflects user-dragged child positions, not dagre's predicted growth. */
export function computeExpandBoundaryRects(
  contentNodes: Node[],
  expandedIds: Set<string>,
  workspace: Workspace,
  tableData?: Record<string, TableDef[]>,
): Map<string, OverlayRect> {
  const rectById = new Map<string, OverlayRect>()
  if (expandedIds.size === 0) return rectById

  const parentOf = buildParentMap(workspace, tableData)
  const depthOf = (id: string): number => {
    let d = 0
    let cur = parentOf.get(id)
    while (cur !== undefined) { d++; cur = parentOf.get(cur) }
    return d
  }
  const ancestorIsExpanded = (id: string, target: string): boolean => {
    let cur = parentOf.get(id)
    while (cur !== undefined) {
      if (cur === target) return true
      cur = parentOf.get(cur)
    }
    return false
  }

  const ownNodeById = new Map<string, Node>()
  for (const n of contentNodes) {
    if (expandedIds.has(n.id)) ownNodeById.set(n.id, n)
  }

  const ordered = [...expandedIds].sort((a, b) => depthOf(b) - depthOf(a))
  for (const expandedId of ordered) {
    const memberRects: OverlayRect[] = contentNodes
      .filter((n) => ancestorIsExpanded(n.id, expandedId))
      .map((n) => nodeRect(n))
    for (const [otherId, rect] of rectById) {
      if (ancestorIsExpanded(otherId, expandedId)) memberRects.push(rect)
    }
    if (memberRects.length === 0) {
      const own = ownNodeById.get(expandedId)
      if (!own) continue
      rectById.set(expandedId, { x: own.position.x, y: own.position.y, w: EMPTY_EXPAND_W, h: EMPTY_EXPAND_H })
      continue
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const r of memberRects) {
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.w)
      maxY = Math.max(maxY, r.y + r.h)
    }
    rectById.set(expandedId, {
      x: minX - EB_PAD_X,
      y: minY - EB_PAD_TOP,
      w: (maxX - minX) + EB_PAD_X * 2,
      h: (maxY - minY) + EB_PAD_TOP + EB_PAD_BOTTOM,
    })
  }
  return rectById
}

/** Draw a boundary box around the children of each expanded element. Computed
 *  from the rendered child content nodes so it survives the overlay rebuild
 *  pass (which strips and regenerates overlays). One box per expanded element;
 *  nested expands nest (a container box inside its system box). */
export function buildExpandBoundaryNodes(
  contentNodes: Node[],
  expandedIds: Set<string>,
  workspace: Workspace,
  tableData?: Record<string, TableDef[]>,
): Node[] {
  if (expandedIds.size === 0) return []

  const parentOf = buildParentMap(workspace, tableData)

  // id → element metadata for label/type (the expanded element's own node is
  // gone — replaced by its children — so read names from the model).
  const meta = new Map<string, { name: string; type: ModelElement['type'] }>()
  for (const sys of workspace.model.softwareSystems) {
    meta.set(sys.id, { name: sys.name, type: 'softwareSystem' })
    for (const c of sys.containers) {
      meta.set(c.id, { name: c.name, type: 'container' })
      for (const comp of c.components) meta.set(comp.id, { name: comp.name, type: 'component' })
    }
  }

  const depthOf = (id: string): number => {
    let d = 0
    let cur = parentOf.get(id)
    while (cur !== undefined) { d++; cur = parentOf.get(cur) }
    return d
  }

  const ancestorIsExpanded = (id: string, target: string): boolean => {
    let cur = parentOf.get(id)
    while (cur !== undefined) {
      if (cur === target) return true
      cur = parentOf.get(cur)
    }
    return false
  }

  // Rects deepest-first so an outer (e.g. system) boundary wraps the inner
  // (e.g. container) box — see computeExpandBoundaryRects. Shared with the
  // sibling-collision push so the push clears exactly what is drawn here.
  const rectById = computeExpandBoundaryRects(contentNodes, expandedIds, workspace, tableData)

  // Detect Database containers so the boundary can adjust its "+" dropdown
  const dbContainerIds = new Set<string>()
  for (const sys of workspace.model.softwareSystems) {
    for (const c of sys.containers) {
      if (c.tags.includes('Database')) dbContainerIds.add(c.id)
    }
  }

  // An expanded element is "empty" (childless) when no content node descends
  // from it and no expanded descendant contributed a rect — its rect is the
  // EMPTY_EXPAND_W/H placeholder footprint.
  const isEmpty = (id: string): boolean =>
    !contentNodes.some((n) => ancestorIsExpanded(n.id, id))
    && ![...rectById.keys()].some((o) => o !== id && ancestorIsExpanded(o, id))

  const ordered = [...expandedIds].sort((a, b) => depthOf(b) - depthOf(a))
  const boundaries: Node[] = []
  for (const expandedId of ordered) {
    const info = meta.get(expandedId)
    if (!info) continue
    const rect = rectById.get(expandedId)
    if (!rect) continue

    const typeLabel = info.type === 'softwareSystem' ? 'Software System'
      : info.type === 'container' ? 'Container' : 'Component'

    const { x, y, w, h } = rect
    if (isEmpty(expandedId)) {
      // Expanded but childless: an empty boundary over the placeholder footprint,
      // with an "add child" affordance + collapse.
      boundaries.push({
        id: `${EXPAND_BOUNDARY_PREFIX}${expandedId}`,
        type: 'boundary',
        position: { x, y },
        measured: { width: w, height: h },
        style: { width: w, height: h, pointerEvents: 'none' },
        data: { name: info.name, typeLabel, empty: true, collapsible: true, elementId: expandedId, isDatabase: dbContainerIds.has(expandedId) },
        zIndex: -5 + depthOf(expandedId),
        selectable: false,
        draggable: false,
        focusable: false,
      })
      continue
    }

    boundaries.push({
      id: `${EXPAND_BOUNDARY_PREFIX}${expandedId}`,
      type: 'boundary',
      position: { x, y },
      measured: { width: w, height: h },
      // Wrapper itself is pointer-opaque so grabbing any empty spot on the box
      // starts a drag (no dragHandle → whole node drags). Child element nodes are
      // separate, higher-z React Flow nodes stacked on top, so they stay
      // interactive; `.nodrag` buttons in the header stay clickable.
      style: { width: w, height: h, pointerEvents: 'auto' },
      data: { name: info.name, typeLabel, collapsible: true, elementId: expandedId, isDatabase: dbContainerIds.has(expandedId) },
      // Deeper boxes sit above their parent box but still behind content (>= 0).
      zIndex: -5 + depthOf(expandedId),
      selectable: false,
      // Draggable as a unit — Canvas.onNodeDragStart wires the members so the
      // whole expanded subtree translates together.
      draggable: true,
      focusable: false,
    })
  }

  return boundaries
}

/** Build edges using final node positions for optimal handle routing. */
export function buildEdges(
  workspace: Workspace,
  view: View,
  nodes: Node[],
  filters: HighlightFilters,
): Edge[] {
  const relationshipMap = buildRelationshipMap(workspace)
  const relationshipStyles = buildRelationshipStyleList(workspace)

  // Position lookup from laid-out nodes
  const posMap = new Map<string, { x: number; y: number }>()
  for (const n of nodes) posMap.set(n.id, n.position)

  const viewElementIds = new Set(view.elements.map((e) => e.id))

  const edgeInfos: EdgeInfo[] = []
  for (const viewRel of view.relationships) {
    const rel = relationshipMap.get(viewRel.id)
    if (!rel) continue
    if (!viewElementIds.has(rel.sourceId) || !viewElementIds.has(rel.destinationId)) continue
    edgeInfos.push(makeEdgeInfo(rel, rel.sourceId, rel.destinationId, posMap, relationshipStyles))
  }

  return assembleEdges(edgeInfos, posMap, nodes, filters)
}

/** Check if a model element is a Container tagged as "Database".
 *  Used by expand-in-place and boundary "+" dropdown to offer DB-specific
 *  affordances (table rendering, Database creation shortcut). */
export function isDatabaseContainer(element: ModelElement): boolean {
  return element.type === 'container' && element.tags.includes('Database')
}

// ─── Database table helpers ──────────────────────────────────────────

/** Synthetic React Flow node ID for a table inside an expanded container. */
export function tableNodeId(containerId: string, tableId: string): string {
  return `__table__${containerId}__${tableId}`
}

/** Compute the rendered size of a table node based on its column count. */
export function getTableNodeSize(tableDef: TableDef): { width: number; height: number } {
  const HEADER_H = 36
  const ROW_H = 20
  return {
    width: 220,
    height: HEADER_H + (tableDef.columns.length || 1) * ROW_H + 8,
  }
}

/** Build a React Flow node for a table definition inside an expanded Database container. */
export function buildTableNode(
  tableDef: TableDef,
  containerId: string,
  parentContainer: ModelElement,
  position: { x: number; y: number },
  ctx: ContentNodeContext,
): Node {
  const style = getElementStyle(parentContainer, ctx.styleIndex)
  return {
    id: tableNodeId(containerId, tableDef.id),
    type: 'table',
    position,
    zIndex: 5, // above boundary overlays (-5..0 range) so clicks reach the table
    selectable: false, // tables use custom onClick, not React Flow selection
    draggable: true,
    data: {
      tableDef,
      containerId,
      style,
    } satisfies TableNodeData,
  }
}

/** Build a child→parent id map for the whole model (container→system,
 *  component→container). People and systems have no parent.
 *  When tableData is provided, also maps synthetic table ids → DB container. */
export function buildParentMap(
  workspace: Workspace,
  tableData?: Record<string, TableDef[]>,
): Map<string, string> {
  const parentOf = new Map<string, string>()
  for (const sys of workspace.model.softwareSystems) {
    for (const container of sys.containers) {
      parentOf.set(container.id, sys.id)
      for (const component of container.components) {
        parentOf.set(component.id, container.id)
      }
      // Table nodes are synthetic children of DB containers
      if (tableData && isDatabaseContainer(container)) {
        const tables = tableData[container.id]
        if (tables) {
          for (const t of tables) {
            parentOf.set(tableNodeId(container.id, t.id), container.id)
          }
        }
      }
    }
  }
  return parentOf
}

/**
 * Expand-in-place edges. For each model relationship a→b, resolve both
 * endpoints to the node that should carry the edge by walking UP from the
 * endpoint until we hit either:
 *   • an *expanded* element — its own node was replaced by its children, but it
 *     is drawn as a wrapper boundary box. The edge attaches to that box so a
 *     parent-level relationship (e.g. A→B) stays at the parent level when B is
 *     expanded, instead of diving onto a child container. Both endpoints
 *     expanded → boundary→boundary.
 *   • a *visible* content node — a leaf, or the nearest visible ancestor of a
 *     collapsed element (the box it folds into).
 * Relationships that resolve to the same node (internal to one box) are dropped;
 * duplicate pairs bundle so one edge can summarize ×N finest relationships.
 */
export function buildCompositeEdges(
  workspace: Workspace,
  nodes: Node[],
  filters: HighlightFilters,
  tableData?: Record<string, TableDef[]>,
): Edge[] {
  const relationshipStyles = buildRelationshipStyleList(workspace)
  const parentOf = buildParentMap(workspace, tableData)

  // Visible ids = content nodes (those carrying a model element). Expanded ids =
  // elements drawn as a wrapper boundary box (`__expand_boundary__<id>`).
  const visibleIds = new Set<string>()
  const expandedIds = new Set<string>()
  const posMap = new Map<string, { x: number; y: number }>()
  for (const n of nodes) {
    posMap.set(n.id, n.position)
    if (n.id.startsWith(EXPAND_BOUNDARY_PREFIX)) {
      expandedIds.add(n.id.slice(EXPAND_BOUNDARY_PREFIX.length))
      continue
    }
    // Hidden own-nodes of childless expanded elements stay in the graph (to
    // preserve position) but aren't rendered — exclude them so edges resolve to
    // the wrapper boundary, not an invisible box.
    if (!n.hidden && (n.data as { element?: ModelElement })?.element) visibleIds.add(n.id)
  }

  // Hierarchy depth of a model element (system/person = 0, container = 1, …).
  const depthOf = (id: string): number => {
    let d = 0
    let cur = parentOf.get(id)
    while (cur !== undefined) { d++; cur = parentOf.get(cur) }
    return d
  }

  // Walk up from `id`, ignoring ancestors deeper than `maxDepth`, and return the
  // deepest expanded (→ wrapper box) or visible node at/under that depth.
  const resolveAtMaxDepth = (id: string, maxDepth: number): string | null => {
    let cur: string | undefined = id
    while (cur !== undefined) {
      if (depthOf(cur) <= maxDepth) {
        if (expandedIds.has(cur)) return `${EXPAND_BOUNDARY_PREFIX}${cur}`
        if (visibleIds.has(cur)) return cur
      }
      cur = parentOf.get(cur)
    }
    return null
  }

  // Natural resolution: the deepest expanded-or-visible ancestor of the endpoint.
  const resolveEndpoint = (id: string): string | null => resolveAtMaxDepth(id, Infinity)

  // Depth of a resolved node id (strip the wrapper prefix to recover the element).
  const resolvedDepth = (resolved: string): number =>
    depthOf(resolved.startsWith(EXPAND_BOUNDARY_PREFIX)
      ? resolved.slice(EXPAND_BOUNDARY_PREFIX.length)
      : resolved)

  const byPair = new Map<string, EdgeInfo>()
  const edgeInfos: EdgeInfo[] = []
  for (const rel of workspace.model.relationships) {
    // Resolve each endpoint naturally, then equalize: a relationship is always
    // drawn between equal C4 levels. If one side folds up to a shallower box
    // (collapsed ancestor) while the other stays deep (expanded, child visible),
    // fold the deeper side up to the shallower's level too — so A1→B1 shows as
    // A→B (wrapper) when A is collapsed, never as a cross-level A→B1.
    const s0 = resolveEndpoint(rel.sourceId)
    const t0 = resolveEndpoint(rel.destinationId)
    if (!s0 || !t0) continue
    const target = Math.min(resolvedDepth(s0), resolvedDepth(t0))
    const s = resolveAtMaxDepth(rel.sourceId, target)
    const t = resolveAtMaxDepth(rel.destinationId, target)
    if (!s || !t || s === t) continue
    const key = `${s}->${t}`
    const existing = byPair.get(key)
    if (existing) {
      existing.bundleCount = (existing.bundleCount ?? 1) + 1
      continue
    }
    const info = makeEdgeInfo(rel, s, t, posMap, relationshipStyles)
    info.bundleCount = 1
    byPair.set(key, info)
    edgeInfos.push(info)
  }

  return assembleEdges(edgeInfos, posMap, nodes, filters)
}

// ─── FK Edge types ──────────────────────────────────────────────────────

export interface FKEdgePair {
  sourceTableId: string
  sourceColumnId: string
  targetTableId: string
  targetColumnId: string
}

/** Scan tables in a container, find isForeignKey columns, match to target
 *  table + PK column via naming convention: `customer_id` → `customers.id`. */
export function resolveTableFKs(tables: TableDef[]): FKEdgePair[] {
  if (tables.length === 0) return []

  // Build lookup: table id → table def, and table name → table def
  const tableByName = new Map<string, TableDef>()
  const pkColumnByName = new Map<string, Map<string, string>>() // table id → pk name → col id

  for (const t of tables) {
    tableByName.set(t.name.toLowerCase(), t)
    const pkMap = new Map<string, string>()
    for (const col of t.columns) {
      if (col.isPrimaryKey) pkMap.set(col.name, col.id ?? col.name)
    }
    if (pkMap.size > 0) pkColumnByName.set(t.id, pkMap)
  }

  const pairs: FKEdgePair[] = []

  for (const table of tables) {
    for (const col of table.columns) {
      if (!col.isForeignKey) continue
      const colId = col.id ?? col.name

      // Try to derive target table from FK column name:
      //   `customer_id` → stem "customer" → table "customers"
      const fkName = col.name
      const idSuffix = fkName.lastIndexOf('_id')
      if (idSuffix <= 0) continue // no "_id" suffix at end (not zero-length stem)

      const stem = fkName.slice(0, idSuffix).toLowerCase()

      // Try common plural forms to find the target table
      const candidateNames = [
        stem,           // e.g. "customer" → "customer"
        `${stem}s`,     // e.g. "customer" → "customers"
        `${stem}es`,    // e.g. "address" → "addresses"
      ]
      // Also handle stems ending in 'y' → 'ies': "category" → "categories"
      if (stem.endsWith('y')) {
        candidateNames.push(`${stem.slice(0, -1)}ies`)
      }

      let targetTable: TableDef | undefined
      for (const candidate of candidateNames) {
        targetTable = tableByName.get(candidate)
        if (targetTable && targetTable.id !== table.id) break
        targetTable = undefined
      }

      if (!targetTable) continue

      // Target table must have a PK column named "id" (convention)
      const targetPKs = pkColumnByName.get(targetTable.id)
      if (!targetPKs || !targetPKs.has('id')) continue

      const targetColId = targetPKs.get('id')!

      pairs.push({
        sourceTableId: table.id,
        sourceColumnId: colId,
        targetTableId: targetTable.id,
        targetColumnId: targetColId,
      })
    }
  }

  return pairs
}

/** FK edge default style — indigo, thin, dashed. Same mechanism as
 *  model relationships so FK edges render with the same RelationshipEdge
 *  component and the user can select+style them identically. */
const FK_EDGE_STYLE: RelationshipStyle = {
  tag: '__fk__',
  color: 'var(--color-fk-edge, #6366f1)',
  thickness: 1.5,
  dashed: true,
}

/** Reconnect decision for an FK edge drag. Returns:
 *  - 'block' — cross-table reconnect (source or target node changed)
 *  - 'reconnect-handle' — same-node handle change (call reconnectEdge)
 *  - 'full-reconnect' — not an FK edge (fall through to model reconnect) */
export function fkReconnectDecision(
  oldEdge: Pick<Edge, 'source' | 'target' | 'data'>,
  newConnection: Pick<Connection, 'source' | 'target'>,
): 'block' | 'reconnect-handle' | 'full-reconnect' {
  const isFk = (oldEdge.data as { isFk?: boolean } | undefined)?.isFk
  if (!isFk) return 'full-reconnect'
  if (newConnection.source !== oldEdge.source || newConnection.target !== oldEdge.target) {
    return 'block'
  }
  return 'reconnect-handle'
}

/** Build React Flow edges between table nodes for FK relationships.
 *  Uses the same `relationship` edge type as model edges so FK edges get
 *  the same path style options (Straight / Curved / Orthogonal) and the
 *  same visual treatment. Auto-resolves FK edges from isForeignKey columns
 *  via naming convention, then layers manual FK edges on top. */
export function buildTableEdges(
  containerId: string,
  tables: TableDef[],
  manualFkEdges?: FkEdgeDef[],
  nodePositions?: Map<string, { x: number; y: number }>,
): Edge[] {
  const edges: Edge[] = []

  // Track which source→target pairs already have an edge (dedup)
  const seenPairs = new Set<string>()

  /** Build an edge object from source/target table IDs + optional column */
  const pushEdge = (
    edgeId: string,
    srcTableId: string,
    tgtTableId: string,
    srcColName: string | undefined,
    srcColId: string | undefined,
    tgtColId: string | undefined,
    lineStyle: LineStyle = 'Orthogonal',
  ) => {
    const srcNodeId = tableNodeId(containerId, srcTableId)
    const tgtNodeId = tableNodeId(containerId, tgtTableId)
    const srcPos = nodePositions?.get(srcNodeId)
    const dstPos = nodePositions?.get(tgtNodeId)
    const handles = srcPos && dstPos
      ? computeHandlePair(srcPos, dstPos)
      : { sourceHandle: 'bottom-b-source', targetHandle: 'top-b-target' }

    // Synthetic relationship so RelationshipEdge renders FK edges natively
    const syntheticRel: Relationship = {
      id: edgeId,
      sourceId: srcTableId,
      destinationId: tgtTableId,
      description: srcColName,
      lineStyle,
      tags: [],
      properties: {},
    }

    edges.push({
      id: edgeId,
      source: srcNodeId,
      target: tgtNodeId,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'relationship',
      data: {
        relationship: syntheticRel,
        relationshipStyle: FK_EDGE_STYLE,
        isFk: true,
        fkSourceColumnId: srcColId,
        fkTargetColumnId: tgtColId,
      },
      selectable: true,
      focusable: false,
      reconnectable: true,
      zIndex: 3,
    })
  }

  // 1. Auto-resolved edges from isForeignKey columns via naming convention
  const autoPairs = resolveTableFKs(tables)
  for (const pair of autoPairs) {
    const sourceTable = tables.find(t => t.id === pair.sourceTableId)
    const sourceCol = sourceTable?.columns.find(c => (c.id ?? c.name) === pair.sourceColumnId)
    const key = `${pair.sourceTableId}->${pair.targetTableId}`
    seenPairs.add(key)
    pushEdge(
      `__fk_auto__${containerId}__${pair.sourceTableId}__${pair.targetTableId}`,
      pair.sourceTableId, pair.targetTableId,
      sourceCol?.name, pair.sourceColumnId, pair.targetColumnId,
    )
  }

  // 2. Manual FK edges — override auto edges for same source→target
  for (const fk of manualFkEdges ?? []) {
    const sourceTable = tables.find(t => t.id === fk.sourceTableId)
    if (!sourceTable) continue
    const targetTable = tables.find(t => t.id === fk.targetTableId)
    if (!targetTable) continue
    const sourceCol = fk.sourceColumnId
      ? sourceTable.columns.find(c => (c.id ?? c.name) === fk.sourceColumnId)
      : undefined

    const key = `${fk.sourceTableId}->${fk.targetTableId}`
    if (seenPairs.has(key)) {
      const autoId = `__fk_auto__${containerId}__${fk.sourceTableId}__${fk.targetTableId}`
      const idx = edges.findIndex(e => e.id === autoId)
      if (idx !== -1) edges.splice(idx, 1)
    }
    seenPairs.add(key)
    pushEdge(
      `__fk_manual__${containerId}__${fk.id}`,
      fk.sourceTableId, fk.targetTableId,
      sourceCol?.name, fk.sourceColumnId, fk.targetColumnId,
      fk.lineStyle ?? 'Orthogonal',
    )
  }

  return edges
}
