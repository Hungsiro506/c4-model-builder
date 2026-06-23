/** Per-edge bezier bend offsets — three handles (Excalidraw-style dots).
 *  Keyed by React Flow edge id. Lost on page reload — v1 only; follow-up adds
 *  sidecar persistence. */

export interface BendHandles {
  /** Midpoint handle offset */
  m: { dx: number; dy: number }
  /** Source-side handle offset (nearer the source node) */
  s: { dx: number; dy: number }
  /** Target-side handle offset (nearer the target node) */
  t: { dx: number; dy: number }
}

const ZERO = { dx: 0, dy: 0 }

const bends = new Map<string, BendHandles>()

export function getBendHandles(edgeId: string): BendHandles {
  return bends.get(edgeId) ?? { m: ZERO, s: ZERO, t: ZERO }
}

export function setBendHandle(
  edgeId: string,
  which: 'm' | 's' | 't',
  offset: { dx: number; dy: number },
): void {
  const cur = bends.get(edgeId) ?? { m: { ...ZERO }, s: { ...ZERO }, t: { ...ZERO } }
  cur[which] = offset
  bends.set(edgeId, cur)
}
