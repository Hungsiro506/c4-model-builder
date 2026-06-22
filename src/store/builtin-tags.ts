import { isChangeStateTag } from '@/lib/changeState'

/** Tags that always exist and whose styles cannot be removed.
 *  'Relationship' is the built-in tag for all relationships and is
 *  included here so removeTagGlobal can't strip it from the model. */
export const BUILTIN_TAGS = new Set([
  'Element',
  'Person',
  'Software System',
  'Container',
  'Component',
  'Relationship',
  'Database',
])

/** Single predicate for "the app owns this tag — the user can't freely rename,
 *  remove, or recolour it". Union of built-in type tags and the reserved
 *  change-state tags. Every tag surface (Tags tab, Tag Manager, store guards)
 *  asks this one question, so a new reserved tag only needs registering once. */
export function isReservedTag(tag: string): boolean {
  return BUILTIN_TAGS.has(tag) || isChangeStateTag(tag)
}
