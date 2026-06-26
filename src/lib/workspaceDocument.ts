import type { Workspace, TableDef, FkEdgeDef } from '@/types/model'
import { parseDSL, type ParseError } from '@/lib/dsl'
import { applySidecar, parseSidecar } from '@/lib/sidecar'

export interface WorkspaceDocumentInput {
  content: string
  fallbackName?: string
  sidecarJson?: string
}

export interface WorkspaceDocumentResult {
  workspace: Workspace
  errors: ParseError[]
  /** Database table definitions extracted from sidecar, keyed by container ID. */
  tableData: Record<string, TableDef[]>
  /** FK edge definitions extracted from sidecar, keyed by container ID. */
  fkEdges: Record<string, FkEdgeDef[]>
}

export function parseWorkspaceDocument({
  content,
  fallbackName,
  sidecarJson,
}: WorkspaceDocumentInput): WorkspaceDocumentResult {
  const { workspace, errors } = parseDSL(content)
  if (!workspace.name && fallbackName) workspace.name = fallbackName

  const sidecar = sidecarJson ? parseSidecar(sidecarJson) : null
  const tableData: Record<string, TableDef[]> = {}
  const fkEdges: Record<string, FkEdgeDef[]> = {}
  if (sidecar) {
    const result = applySidecar(workspace, sidecar)
    if (result.tableData) Object.assign(tableData, result.tableData)
    if (result.fkEdges) Object.assign(fkEdges, result.fkEdges)
  }

  return { workspace, errors, tableData, fkEdges }
}
