import type { Workspace, ElementStatus, LineStyle, TableDef, ColumnDef } from '@/types/model'
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
  name: string
  type: string
  primaryKey: boolean
  nullable: boolean
  foreignKey?: string
  defaultValue?: string
  description?: string
}

interface SidecarTable {
  id: string
  name: string
  description?: string
  columns: SidecarTableColumn[]
}

export interface SidecarData {
  version: 1
  elements?: Record<string, SidecarElement>
  relationships?: Record<string, SidecarRelationship>
  views?: Record<string, SidecarView>
  /** Database table definitions keyed by container ID. Sidecar-only — never in DSL. */
  tables?: Record<string, SidecarTable[]>
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

function isSidecarTableColumn(value: unknown): value is SidecarTableColumn {
  if (!isRecord(value)) return false
  if (typeof value.name !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.primaryKey !== 'boolean') return false
  if (typeof value.nullable !== 'boolean') return false
  if ('foreignKey' in value && value.foreignKey !== undefined && typeof value.foreignKey !== 'string') return false
  if ('defaultValue' in value && value.defaultValue !== undefined && typeof value.defaultValue !== 'string') return false
  if ('description' in value && value.description !== undefined && typeof value.description !== 'string') return false
  return true
}

function isSidecarTable(value: unknown): value is SidecarTable {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.name !== 'string') return false
  if ('description' in value && value.description !== undefined && typeof value.description !== 'string') return false
  if (!Array.isArray(value.columns) || !value.columns.every(isSidecarTableColumn)) return false
  return true
}

function isSidecarTableRecord(value: unknown): value is Record<string, SidecarTable[]> {
  if (!isRecord(value)) return false
  for (const v of Object.values(value)) {
    if (!Array.isArray(v) || !v.every(isSidecarTable)) return false
  }
  return true
}

function isSidecarData(value: unknown): value is SidecarData {
  if (!isRecord(value) || value.version !== 1) return false
  if ('elements' in value && value.elements !== undefined && !isRecordOf(value.elements, isSidecarElement)) return false
  if ('relationships' in value && value.relationships !== undefined && !isRecordOf(value.relationships, isSidecarRelationship)) return false
  if ('views' in value && value.views !== undefined && !isRecordOf(value.views, isSidecarView)) return false
  if ('tables' in value && value.tables !== undefined && !isSidecarTableRecord(value.tables)) return false
  return true
}

// ─── Extract sidecar from workspace ─────────────────────────────────

export function extractSidecar(
  workspace: Workspace,
  tableData?: Record<string, TableDef[]>,
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

  // Tables: database table definitions (sidecar-only metadata)
  if (tableData && Object.keys(tableData).length > 0) {
    const tables: Record<string, SidecarTable[]> = {}
    for (const [containerId, tableDefs] of Object.entries(tableData)) {
      if (tableDefs.length === 0) continue
      tables[containerId] = tableDefs.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || undefined,
        columns: t.columns.map((c) => ({
          name: c.name,
          type: c.type,
          primaryKey: c.primaryKey,
          nullable: c.nullable,
          foreignKey: c.foreignKey || undefined,
          defaultValue: c.defaultValue || undefined,
          description: c.description || undefined,
        })),
      }))
    }
    if (Object.keys(tables).length > 0) {
      sidecar.tables = tables
      hasData = true
    }
  }

  return hasData ? sidecar : null
}

// ─── Apply sidecar to workspace ─────────────────────────────────────

export interface AppliedTables {
  tables: Record<string, TableDef[]>
}

export function applySidecar(workspace: Workspace, sidecar: SidecarData): AppliedTables | void {
  if (sidecar.version !== 1) return

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

  // Tables: extract from sidecar into store-consumable format
  if (sidecar.tables) {
    const tables: Record<string, TableDef[]> = {}
    for (const [containerId, rawTables] of Object.entries(sidecar.tables)) {
      tables[containerId] = rawTables.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? '',
        columns: t.columns.map((c): ColumnDef => ({
          name: c.name,
          type: c.type,
          primaryKey: c.primaryKey,
          nullable: c.nullable,
          foreignKey: c.foreignKey,
          defaultValue: c.defaultValue,
          description: c.description ?? '',
        })),
      }))
    }
    return { tables }
  }
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
