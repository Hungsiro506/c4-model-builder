/** Per-edge bezier bend offsets. Keyed by React Flow edge id (normally the
 *  relationship id). Lost on page reload — v1 only; follow-up adds sidecar
 *  persistence. */
const bends = new Map<string, { dx: number; dy: number }>()

export function getBendOffset(edgeId: string): { dx: number; dy: number } | undefined {
  return bends.get(edgeId)
}

export function setBendOffset(edgeId: string, offset: { dx: number; dy: number }): void {
  bends.set(edgeId, offset)
}

export function clearBendOffset(edgeId: string): void {
  bends.delete(edgeId)
}
