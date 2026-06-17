import type { Workspace } from '@/types/model'

export interface ScopeViolation {
  type: 'error' | 'warning'
  message: string
  /** Optional anchor — when present, the violation is scoped to this element. */
  elementId?: string
  /** Optional anchor — when present, the violation is scoped to this relationship. */
  relationshipId?: string
}

export function validateScope(workspace: Workspace): ScopeViolation[] {
  const violations: ScopeViolation[] = []
  const { scope, model } = workspace
  const systems = model.softwareSystems ?? []
  const allContainers = systems.flatMap(s => s.containers ?? [])

  // Workspace-scope rules (global — no elementId)
  if (scope && scope !== 'none') {
    if (scope === 'landscape') {
      if (allContainers.length > 0) {
        violations.push({
          type: 'error',
          message: `Landscape-scoped workspaces must not define containers. Found ${allContainers.length} container(s).`,
        })
      }
    }
  }

  // Per-element rules — these carry elementId / relationshipId so the canvas
  // can render a badge on the offending node or edge.
  const allElementIds = new Set<string>()
  for (const p of model.people ?? []) allElementIds.add(p.id)
  for (const s of systems) {
    allElementIds.add(s.id)
    for (const c of s.containers ?? []) {
      allElementIds.add(c.id)
      for (const cmp of c.components ?? []) allElementIds.add(cmp.id)
    }
  }

  // Relationships that point at a missing source or destination
  for (const rel of model.relationships ?? []) {
    if (!allElementIds.has(rel.sourceId)) {
      violations.push({
        type: 'error',
        message: `Relationship source element is missing.`,
        relationshipId: rel.id,
      })
    }
    if (!allElementIds.has(rel.destinationId)) {
      violations.push({
        type: 'error',
        message: `Relationship destination element is missing.`,
        relationshipId: rel.id,
      })
    }
  }

  // Containers / components that exist in scopes that don't allow them.
  if (scope === 'landscape') {
    for (const s of systems) {
      for (const c of s.containers ?? []) {
        violations.push({
          type: 'error',
          message: `Container "${c.name}" can't exist in a landscape-scoped workspace.`,
          elementId: c.id,
        })
      }
    }
  }

  return violations
}

export function scopeAllowsContainers(scope?: string): boolean {
  return scope !== 'landscape'
}

export function scopeLabel(scope?: string): string {
  if (scope === 'softwaresystem') return 'Software system'
  if (scope === 'landscape') return 'System landscape'
  return 'Unscoped'
}
