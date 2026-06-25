// Lazy, cached access to the mermaid library.
//
// Previously `import mermaid from 'mermaid'` was a static import in 3 files, so
// the (multi-MB) library was loaded and resident in memory the moment the
// editor mounted — even for documents with no diagrams. This module:
//   1. lazy-loads mermaid on first use and dedupes the import promise so the
//      many LivePreviewNodeView instances only trigger one dynamic import;
//   2. caches rendered SVGs keyed by `source + theme` so identical diagrams
//      (and theme switches) don't re-run the expensive dagre/d3 layout.

export type MermaidTheme = 'default' | 'dark' | 'forest' | 'neutral' | string

// Minimal structural type for the mermaid API surface we use. mermaid ships no
// bundled .d.ts, so `import('mermaid')` resolves to any; this keeps the loader
// typed without depending on @types/mermaid.
interface MermaidApi {
  initialize(config: Record<string, unknown>): void
  render(id: string, text: string): Promise<{ svg: string; bindFunctions?: (element: Element) => void }>
}

let mermaidPromise: Promise<MermaidApi> | null = null
let mermaidInitialized = false

// Current theme used as part of the render cache key. Updated by initMermaid.
let currentTheme: MermaidTheme = 'default'

// LRU-ish guard: cap the cache so a long editing session with many distinct
// diagrams can't grow it without bound.
const RENDER_CACHE_LIMIT = 200
const renderCache = new Map<string, string>()

/**
 * Returns the (memoized) promise that resolves to the mermaid module. Safe to
 * call from many places concurrently — only the first call triggers the import.
 */
export function getMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    // mermaid exposes its API (initialize/render/...) on the `default` export
    // of its ESM module.
    mermaidPromise = import('mermaid').then((mod) => {
      const api = (mod as { default?: MermaidApi }).default ?? (mod as unknown as MermaidApi)
      return api
    })
  }
  return mermaidPromise
}

/**
 * Initialize mermaid with the given theme (idempotent for the same theme).
 * Ensures mermaid is initialized before any render runs.
 */
export async function initMermaid(theme: MermaidTheme): Promise<void> {
  const mermaid = await getMermaid()
  if (!mermaidInitialized || theme !== currentTheme) {
    mermaid.initialize({ theme: theme as 'default' | 'dark' | 'forest' | 'neutral', startOnLoad: false })
    // Theme changed → previously cached SVGs were rendered for the old theme,
    // invalidate them so diagrams redraw with the new colors.
    if (currentTheme !== theme) {
      renderCache.clear()
    }
    currentTheme = theme
    mermaidInitialized = true
  }
}

/** Render counter for unique mermaid ids (mirrors the old module-level counter). */
let renderCount = 0

/**
 * Render a mermaid diagram source to an SVG string. Cached by
 * `${source}::${currentTheme}`. Throws on parse/render error after cleaning up
 * mermaid's error placeholder dom.
 */
export async function renderMermaid(source: string): Promise<string> {
  const cacheKey = `${source}::${currentTheme}`
  const cached = renderCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const mermaid = await getMermaid()
  renderCount++
  const id = `mermaid-${renderCount}`
  let svg: string
  try {
    const res = await mermaid.render(id, source)
    svg = res.svg
  } catch (err) {
    // Mermaid leaves an error placeholder dom (#d<id>) in the document on
    // failure; remove it so failed renders don't accumulate invisible nodes.
    document.getElementById('d' + id)?.remove()
    throw err
  }

  if (renderCache.size >= RENDER_CACHE_LIMIT) {
    // Evict the oldest entry (Map preserves insertion order).
    const firstKey = renderCache.keys().next().value
    if (firstKey !== undefined) renderCache.delete(firstKey)
  }
  renderCache.set(cacheKey, svg)
  return svg
}
