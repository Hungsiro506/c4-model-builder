import type { Workspace, ElementStatus, LineStyle, TableDef, FkEdgeDef } from '@/types/model'
import { allViewsOf } from '@/store/workspace-helpers'
import { createLogger } from '@/lib/logger'
import { isFiniteNumber, isRecord, isRecordOf } from '@/lib/guards'
import { sanitizeFilename } from '@/lib/filenames'

const VALID_STATUSES: ReadonlySet<string> = new Set<ElementStatus>(['Live', 'Planned', 'Deprecated', 'Removed'])
const VALID_LINE_STYLES: ReadonlySet<string> = new Set<LineStyle>(['Curved', 'Straight', 'Orthogonal'])

function isValidStatus(v: unknown): v is ElementStatus {
  return typeof v === 'string' && VALID_STATUSES.has(v)
}

function isValidLineStyle(v: unknown): v is LineStyle {
  return typeof v === 'string' && VALID_LINE_STYLES.has(v)
}

const log = createLogger('sidecar')

// ─── Sidecar schema ─────────────────────────────────────────────────
// Stores c4hero-specific metadata that isn't part of the Structurizr DSL.

interface SidecarElement {
  status?: ElementStatus
  owner?: string
}

interface SidecarRelationship {
  lineStyle?: LineStyle
}

interface SidecarViewElement {
  pinned?: boolean
  x?: number
  y?: number
  /** Expanded element ids whose gap-shift is baked into x/y (dragged while expanded). */
  shiftExempt?: string[]
}

interface SidecarExpandedElement {
  x?: number
  y?: number
}

interface SidecarView {
  elements?: Record<string, SidecarViewElement>
  /** Absolute positions of dragged expand-in-place children, keyed by child id. */
  expanded?: Record<string, SidecarExpandedElement>
}

interface SidecarTableColumn {
  id?: string
  name: string
  type: string
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  description?: string
}

interface SidecarTable {
  id: string
  name: string
  description?: string
  columns: SidecarTableColumn[]
}

interface SidecarFkEdge {
  id: string
  sourceTableId: string
  targetTableId: string
  sourceColumnId?: string
  targetColumnId?: string
  lineStyle?: string
}

export interface SidecarData {
  version: 1
  elements?: Record<string, SidecarElement>
  relationships?: Record<string, SidecarRelationship>
  views?: Record<string, SidecarView>
  /** Database table definitions, keyed by container ID. Sidecar-only, never in DSL. */
  tables?: Record<string, SidecarTable[]>
  /** FK edge definitions, keyed by container ID. Sidecar-only, never in DSL. */
  fkEdges?: Record<string, SidecarFkEdge[]>
}

function isSidecarElement(value: unknown): value is SidecarElement {
  if (!isRecord(value)) return false
  if ('status' in value && value.status !== undefined && !isValidStatus(value.status)) return false
  if ('owner' in value && value.owner !== undefined && typeof value.owner !== 'string') return false
  return true
}

function isSidecarRelationship(value: unknown): value is SidecarRelationship {
  if (!isRecord(value)) return false
  if ('lineStyle' in value && value.lineStyle !== undefined && !isValidLineStyle(value.lineStyle)) return false
  return true
}

function isSidecarViewElement(value: unknown): value is SidecarViewElement {
  if (!isRecord(value)) return false
  if ('pinned' in value && value.pinned !== undefined && typeof value.pinned !== 'boolean') return false
  if ('x' in value && value.x !== undefined && !isFiniteNumber(value.x)) return false
  if ('y' in value && value.y !== undefined && !isFiniteNumber(value.y)) return false
  if ('shiftExempt' in value && value.shiftExempt !== undefined
    && !(Array.isArray(value.shiftExempt) && value.shiftExempt.every((id) => typeof id === 'string'))) return false
  return true
}

function isSidecarExpandedElement(value: unknown): value is SidecarExpandedElement {
  if (!isRecord(value)) return false
  if ('x' in value && value.x !== undefined && !isFiniteNumber(value.x)) return false
  if ('y' in value && value.y !== undefined && !isFiniteNumber(value.y)) return false
  return true
}

function isSidecarView(value: unknown): value is SidecarView {
  if (!isRecord(value)) return false
  if ('elements' in value && value.elements !== undefined && !isRecordOf(value.elements, isSidecarViewElement)) return false
  if ('expanded' in value && value.expanded !== undefined && !isRecordOf(value.expanded, isSidecarExpandedElement)) return false
  return true
}

function isSidecarFkEdge(value: unknown): value is SidecarFkEdge {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.sourceTableId !== 'string') return false
  if (typeof value.targetTableId !== 'string') return false
  if ('sourceColumnId' in value && value.sourceColumnId !== undefined && typeof value.sourceColumnId !== 'string') return false
  if ('targetColumnId' in value && value.targetColumnId !== undefined && typeof value.targetColumnId !== 'string') return false
  return true
}

function isSidecarTableColumn(value: unknown): value is SidecarTableColumn {
  if (!isRecord(value)) return false
  if (typeof value.name !== 'string' || typeof value.type !== 'string') return false
  if ('id' in value && value.id !== undefined && typeof value.id !== 'string') return false
  if ('isPrimaryKey' in value && value.isPrimaryKey !== undefined && typeof value.isPrimaryKey !== 'boolean') return false
  if ('isForeignKey' in value && value.isForeignKey !== undefined && typeof value.isForeignKey !== 'boolean') return false
  if ('description' in value && value.description !== undefined && typeof value.description !== 'string') return false
  return true
}

function isSidecarTable(value: unknown): value is SidecarTable {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if ('description' in value && value.description !== undefined && typeof value.description !== 'string') return false
  if (!Array.isArray(value.columns) || !value.columns.every(isSidecarTableColumn)) return false
  return true
}

function isSidecarData(value: unknown): value is SidecarData {
  if (!isRecord(value) || value.version !== 1) return false
  if ('elements' in value && value.elements !== undefined && !isRecordOf(value.elements, isSidecarElement)) return false
  if ('relationships' in value && value.relationships !== undefined && !isRecordOf(value.relationships, isSidecarRelationship)) return false
  if ('views' in value && value.views !== undefined && !isRecordOf(value.views, isSidecarView)) return false
  if ('tables' in value && value.tables !== undefined) {
    if (!isRecord(value.tables)) return false
    for (const tableList of Object.values(value.tables)) {
      if (!Array.isArray(tableList) || !tableList.every(isSidecarTable)) return false
    }
  }
  if ('fkEdges' in value && value.fkEdges !== undefined) {
    if (!isRecord(value.fkEdges)) return false
    for (const edgeList of Object.values(value.fkEdges)) {
      if (!Array.isArray(edgeList) || !edgeList.every(isSidecarFkEdge)) return false
    }
  }
  return true
}

// ─── Extract sidecar from workspace ─────────────────────────────────

export function extractSidecar(
  workspace: Workspace,
  tableData?: Record<string, TableDef[]>,
  fkEdges?: Record<string, FkEdgeDef[]>,
): SidecarData | null {
  const sidecar: SidecarData = { version: 1 }
  let hasData = false

  // Note: status, owner, and lineStyle are now serialized in the DSL — not duplicated here.
  // SidecarElement + SidecarRelationship readers in applySidecar are kept for backward-compat
  // migration of existing sidecar files written by older versions of c4hero.

  // Views: pinned elements
  const views: Record<string, SidecarView> = {}
  for (const view of allViewsOf(workspace)) {
    const viewElements: Record<string, SidecarViewElement> = {}
    for (const el of view.elements) {
      if (el.pinned) {
        const entry: SidecarViewElement = { pinned: true }
        if (el.x !== undefined) entry.x = el.x
        if (el.y !== undefined) entry.y = el.y
        if (el.shiftExempt?.length) entry.shiftExempt = [...el.shiftExempt]
        viewElements[el.id] = entry
        hasData = true
      }
    }
    const expanded: Record<string, SidecarExpandedElement> = {}
    for (const el of view.expandedLayout ?? []) {
      if (el.x !== undefined && el.y !== undefined) {
        expanded[el.id] = { x: el.x, y: el.y }
        hasData = true
      }
    }
    const viewEntry: SidecarView = {}
    if (Object.keys(viewElements).length > 0) viewEntry.elements = viewElements
    if (Object.keys(expanded).length > 0) viewEntry.expanded = expanded
    if (Object.keys(viewEntry).length > 0) views[view.key] = viewEntry
  }
  if (Object.keys(views).length > 0) sidecar.views = views

  // Tables: database table definitions keyed by container ID
  if (tableData) {
    const tables: Record<string, SidecarTable[]> = {}
    for (const [containerId, tableList] of Object.entries(tableData)) {
      if (tableList.length > 0) {
        tables[containerId] = tableList.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          columns: t.columns.map(c => ({
            id: c.id ?? c.name,
            name: c.name,
            type: c.type,
            ...(c.isPrimaryKey !== undefined ? { isPrimaryKey: c.isPrimaryKey } : {}),
            ...(c.isForeignKey !== undefined ? { isForeignKey: c.isForeignKey } : {}),
            ...(c.description !== undefined ? { description: c.description } : {}),
          })),
        }))
        hasData = true
      }
    }
    if (Object.keys(tables).length > 0) sidecar.tables = tables
  }

  // FK edges: foreign key relationships between tables, keyed by container ID
  if (fkEdges) {
    const edges: Record<string, SidecarFkEdge[]> = {}
    for (const [containerId, edgeList] of Object.entries(fkEdges)) {
      if (edgeList.length > 0) {
        edges[containerId] = edgeList.map(e => ({
          id: e.id,
          sourceTableId: e.sourceTableId,
          targetTableId: e.targetTableId,
          ...(e.sourceColumnId !== undefined ? { sourceColumnId: e.sourceColumnId } : {}),
          ...(e.targetColumnId !== undefined ? { targetColumnId: e.targetColumnId } : {}),
          ...(e.lineStyle !== undefined ? { lineStyle: e.lineStyle } : {}),
        }))
        hasData = true
      }
    }
    if (Object.keys(edges).length > 0) sidecar.fkEdges = edges
  }

  return hasData ? sidecar : null
}

// ─── Apply sidecar to workspace ─────────────────────────────────────

/** Apply sidecar data to a workspace. Returns table definitions and FK edges
 *  extracted from the sidecar (keyed by container ID), or null if empty. */
export function applySidecar(workspace: Workspace, sidecar: SidecarData): {
  tableData: Record<string, TableDef[]> | null
  fkEdges: Record<string, FkEdgeDef[]> | null
} {
  if (sidecar.version !== 1) return { tableData: null, fkEdges: null }

  // Elements — only apply known sidecar properties
  if (sidecar.elements) {
    const applyToElement = (id: string, data: SidecarElement) => {
      // Explicit property-by-property assignment with runtime type validation.
      // No Object.assign — avoids prototype pollution and enforces valid union values.
      // DSL is the authoritative source; sidecar is a migration fallback for files
      // written before status/owner were serialized in the DSL.
      const applyProps = (el: { status?: ElementStatus; owner?: string }) => {
        if (el.status === undefined && isValidStatus(data.status)) el.status = data.status
        if (el.owner === undefined && typeof data.owner === 'string') el.owner = data.owner
      }
      // People
      for (const p of workspace.model.people) {
        if (p.id === id) { applyProps(p); return }
      }
      // Systems, containers, components
      for (const sys of workspace.model.softwareSystems) {
        if (sys.id === id) { applyProps(sys); return }
        for (const c of sys.containers) {
          if (c.id === id) { applyProps(c); return }
          for (const comp of c.components) {
            if (comp.id === id) { applyProps(comp); return }
          }
        }
      }
    }
    for (const [id, data] of Object.entries(sidecar.elements)) {
      applyToElement(id, data)
    }
  }

  // Relationships
  if (sidecar.relationships) {
    for (const rel of workspace.model.relationships) {
      const data = sidecar.relationships[rel.id]
      if (data) {
        if (isValidLineStyle(data.lineStyle)) rel.lineStyle = data.lineStyle
      }
    }
  }

  // Views: pinned + expand-in-place child positions
  if (sidecar.views) {
    for (const view of allViewsOf(workspace)) {
      const viewData = sidecar.views[view.key]
      if (!viewData) continue
      if (viewData.elements) {
        for (const el of view.elements) {
          const elData = viewData.elements[el.id]
          if (elData?.pinned) {
            el.pinned = true
            if (isFiniteNumber(elData.x)) el.x = elData.x
            if (isFiniteNumber(elData.y)) el.y = elData.y
            if (Array.isArray(elData.shiftExempt) && elData.shiftExempt.length > 0) {
              el.shiftExempt = elData.shiftExempt.filter((id): id is string => typeof id === 'string')
            }
          }
        }
      }
      if (viewData.expanded) {
        const expandedLayout = view.expandedLayout ?? []
        for (const [id, pos] of Object.entries(viewData.expanded)) {
          if (!isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) continue
          const existing = expandedLayout.find((e) => e.id === id)
          if (existing) {
            existing.x = pos.x
            existing.y = pos.y
          } else {
            expandedLayout.push({ id, x: pos.x, y: pos.y })
          }
        }
        if (expandedLayout.length > 0) view.expandedLayout = expandedLayout
      }
    }
  }

  // Tables: extract from sidecar
  let tableData: Record<string, TableDef[]> | null = null
  if (sidecar.tables) {
    tableData = {}
    for (const [containerId, tableList] of Object.entries(sidecar.tables)) {
      tableData[containerId] = tableList.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        columns: t.columns.map(c => ({
          id: c.id ?? c.name,
          name: c.name,
          type: c.type,
          isPrimaryKey: c.isPrimaryKey,
          isForeignKey: c.isForeignKey,
          description: c.description,
        })),
      }))
    }
  }

  // FK edges: extract from sidecar
  let fkEdges: Record<string, FkEdgeDef[]> | null = null
  if (sidecar.fkEdges) {
    fkEdges = {}
    for (const [containerId, edgeList] of Object.entries(sidecar.fkEdges)) {
      fkEdges[containerId] = edgeList.map(e => ({
        id: e.id,
        sourceTableId: e.sourceTableId,
        targetTableId: e.targetTableId,
        sourceColumnId: e.sourceColumnId,
        targetColumnId: e.targetColumnId,
        lineStyle: e.lineStyle as FkEdgeDef['lineStyle'],
      }))
    }
  }

  return { tableData, fkEdges }
}

// ─── Sidecar filename ───────────────────────────────────────────────

export function sidecarName(dslName: string): string {
  const baseName = dslName.replace(/\.dsl$/i, '')
  const safeBaseName = sanitizeFilename(baseName)
  return `${safeBaseName === 'download' ? 'workspace' : safeBaseName}.c4hero.json`
}

export function serializeSidecar(data: SidecarData): string {
  return JSON.stringify(data, null, 2)
}

export function parseSidecar(json: string): SidecarData | null {
  try {
    const data = JSON.parse(json)
    return isSidecarData(data) ? data : null
  } catch (err) {
    log.warn('Failed to parse sidecar JSON', err)
    return null
  }
}
