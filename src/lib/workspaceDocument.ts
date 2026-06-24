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
  /** Database table definitions from sidecar, keyed by container ID. */
  tableData: Record<string, TableDef[]>
}

export function parseWorkspaceDocument({
  content,
  fallbackName,
  sidecarJson,
}: WorkspaceDocumentInput): WorkspaceDocumentResult {
  const { workspace, errors } = parseDSL(content)
  if (!workspace.name && fallbackName) workspace.name = fallbackName

  let tableData: Record<string, TableDef[]> = {}
  const sidecar = sidecarJson ? parseSidecar(sidecarJson) : null
  if (sidecar) {
    const applied = applySidecar(workspace, sidecar)
    if (applied?.tables) tableData = applied.tables
  }

  return { workspace, errors, tableData }
}
