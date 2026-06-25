import { normalizeReference } from 'markdown-it/lib/common/utils.mjs'
import { EditorState, PluginKey, Transaction } from '@rme-sdk/pm/state'
import { CreateExtensionPlugin, PlainExtension } from '@rme-sdk/core'

export interface ReferEntry {
  href: string
  title: string
  label: string
}

export type ReferenceIndex = Map<string, ReferEntry>

/**
 * Plugin key shared between the extension and readers (e.g. the image nodeView).
 * Built once so that {@link getReferenceIndex} can look the state up by key.
 */
export const referenceIndexPluginKey = new PluginKey<ReferenceIndex>('referenceIndex')

/**
 * Build the reference index by scanning the top-level `reference_def` nodes of
 * the document. The logic mirrors what the image nodeView used to do per-image
 * per-render, but here it runs once per document change and is shared by every
 * image nodeView.
 */
function buildIndex(state: EditorState): ReferenceIndex {
  const index: ReferenceIndex = new Map()

  state.doc.content.content.forEach((node) => {
    if (node.type.name !== 'reference_def') return

    const labelNode = node.content.content.find((c) => c.type.name === 'reference_label')
    const hrefNode = node.content.content.find((c) => c.type.name === 'reference_href')
    const titleNode = node.content.content.find((c) => c.type.name === 'reference_title')

    if (!labelNode?.textContent) return

    const key = normalizeReference(labelNode.textContent)
    if (!key) return

    index.set(key, {
      href: hrefNode?.textContent || '',
      title: titleNode?.textContent || '',
      label: labelNode.textContent,
    })
  })

  return index
}

/**
 * Read the reference index from an editor state. O(1) lookup for callers.
 */
export function getReferenceIndex(state: EditorState): ReferenceIndex | undefined {
  return referenceIndexPluginKey.getState(state)
}

/**
 * Maintains a document-wide index of `reference_def` nodes so that nodeViews
 * (notably the image nodeView resolving `![alt][label]` references) can look up
 * their href/title in O(1) instead of scanning the whole document on every
 * render of every image.
 */
export class ReferenceIndexExtension extends PlainExtension {
  get name() {
    return 'referenceIndex' as const
  }

  createPlugin(): CreateExtensionPlugin<ReferenceIndex> {
    return {
      state: {
        init: (_config: unknown, state: EditorState) => buildIndex(state),
        apply: (tr: Transaction, value: ReferenceIndex, _oldState: EditorState, newState: EditorState) => {
          // Only rebuild when the document actually changed; selection/meta-only
          // transactions reuse the cached index.
          if (tr.docChanged) {
            return buildIndex(newState)
          }
          return value
        },
      },
    }
  }
}
