import type { Workspace, TableDef } from '@/types/model'
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
  if (sidecar) {
    const tables = applySidecar(workspace, sidecar)
    if (tables) Object.assign(tableData, tables)
  }

  return { workspace, errors, tableData }
}
