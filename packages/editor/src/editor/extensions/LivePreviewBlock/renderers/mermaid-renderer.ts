import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import { eventBus } from '../../../utils/eventbus'
import { minimalSetup } from '../../CodeMirror/setup'
import type { LivePreviewNodeViewApi, LivePreviewRenderer } from '../live-preview-types'
import { renderMermaid } from './mermaid-loader'

export function createMermaidRenderer(options: {
  codemirrorExtensions?: CodeMirrorExtension[]
}): LivePreviewRenderer {
  return {
    languageName: 'mermaid',
    displayName: 'Mermaid',
    className: 'mf-live-preview-mermaid',
    getCodeMirrorExtensions: () => options.codemirrorExtensions ?? [minimalSetup],
    render: async (content, container) => {
      const source = content.trim()
      container.replaceChildren()

      if (!source) {
        return
      }

      // renderMermaid handles caching + error-placeholder cleanup internally.
      const svg = await renderMermaid(source)
      container.innerHTML = svg
    },
    onMount: (view: LivePreviewNodeViewApi) => {
      eventBus.on('change-theme', view.render)
    },
    onDestroy: (view: LivePreviewNodeViewApi) => {
      eventBus.detach('change-theme', view.render)
    },
  }
}
