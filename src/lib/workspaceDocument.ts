import type { Workspace } from '@/types/model'
import { parseDSL, type ParseError } from '@/lib/dsl'
import { applySidecar, parseSidecar, type AppliedSidecar } from '@/lib/sidecar'

export interface WorkspaceDocumentInput {
  content: string
  fallbackName?: string
  sidecarJson?: string
}

export interface WorkspaceDocumentResult {
  workspace: Workspace
  errors: ParseError[]
  /** Per-element and per-relationship visual overrides from the sidecar
   *  (separate from the DSL model so the .dsl stays pure Structurizr). */
  applied?: AppliedSidecar
}

export function parseWorkspaceDocument({
  content,
  fallbackName,
  sidecarJson,
}: WorkspaceDocumentInput): WorkspaceDocumentResult {
  const { workspace, errors } = parseDSL(content)
  if (!workspace.name && fallbackName) workspace.name = fallbackName

  const sidecar = sidecarJson ? parseSidecar(sidecarJson) : null
  const applied = sidecar ? applySidecar(workspace, sidecar) : undefined

  return { workspace, errors, applied }
}
