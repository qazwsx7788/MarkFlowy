import 'antd/dist/antd.css'
import 'katex/dist/katex.min.css'
import React, { FC, useCallback, useRef, useState } from 'react'
import 'remixicon/fonts/remixicon.css'
import { ThemeProvider as ZThemeProvider } from 'zens'
import './App.css'
import {
  Editor,
  EditorRef,
  EditorViewType,
  ThemeProvider,
  createSourceCodeDelegate,
  createWysiwygDelegate,
  extractMatches,
} from './editor'
import { ConfigPanel, EditorType, FindState } from './playground/components/ConfigPanel'
import { ConfigTrigger } from './playground/components/ConfigTrigger'
import { DebugButton } from './playground/components/DebugButton'
import { DebugConsole } from './playground/components/DebugConsole'
import useContent from './playground/hooks/use-content'
import useDevTools from './playground/hooks/use-devtools'

let themeEl: undefined | HTMLStyleElement
const THEME_ID = 'mf-markdown-theme'

export function loadThemeCss(url: string) {
  if (themeEl) themeEl.remove()

  themeEl = document.createElement('style')
  themeEl.setAttribute('id', THEME_ID)
  themeEl.innerHTML = url
  document.head.appendChild(themeEl)
}

const debounce = (fn: (...args: any) => void, delay: number) => {
  let timer: number
  return (...args: any) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), delay)
  }
}

const sleep = (time = 1000) => new Promise((res) => setTimeout(res, time))

const createAppWysiwygDelegate = () =>
  createWysiwygDelegate({
    disableAllBuildInShortcuts: true,
    codemirrorOptions: {
      lineWrapping: true,
    },
    overrideShortcutMap: {
      copy: 'mod-0',
      cut: 'mod-x',
      paste: 'mod-Shift-1',
      redo: 'mod-Shift-z',
      toggleCodeText: 'mod-e',
      toggleDelete: 'mod-Shift-s',
      toggleEmphasis: 'mod-i',
      insertCurrentDate: 'mod-;',
      toggleH1: 'mod-1',
      toggleH2: 'mod-2',
      toggleH3: 'mod-3',
      toggleH4: 'mod-4',
      toggleH5: 'mod-5',
      toggleH6: 'mod-6',
      toggleStrong: 'mod-b',
      undo: 'mod-z',
    },
    uploadImageHandler: function (files: any[]): any[] {
      let completed = 0
      const promises: any[] = []

      for (const { file, progress } of files) {
        promises.push(
          () =>
            new Promise<any>((resolve) => {
              const reader = new FileReader()

              reader.addEventListener(
                'load',
                (readerEvent) => {
                  completed += 1
                  progress(completed / files.length)
                  resolve({
                    src: readerEvent.target?.result as string,
                    'data-file-name': file.name,
                  })
                },
                { once: true },
              )

              reader.readAsDataURL(file)
            }),
        )
      }

      return promises
    },
    async imagePasteHandler(src) {
      await sleep()
      console.log('imagePasteHandler', src)
      return src
    },
    async handleViewImgSrcUrl(src) {
      await sleep()
      console.log('handleViewImgSrcUrl', src)
      return src
    },
  })

function App() {
  const editorRef = React.useRef<EditorRef>(null)
  const { contentId, content, hasUnsavedChanges, setContentId, setContent } = useContent()
  const { enableDevTools, setEnableDevTools } = useDevTools()
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [enableTypewriterScroll, setEnableTypewriterScroll] = useState(false)
  const [editorDelegate, setEditorDelegate] = useState(createAppWysiwygDelegate())
  const editorCtxRef = useRef<any>(null)
  const [configPanelOpen, setConfigPanelOpen] = useState(false)
  const [editorType, setEditorType] = useState<EditorType>('wysiwyg')

  const [findState, setFindState] = useState<FindState>({
    query: '',
    replacement: '',
    activeIndex: null,
    total: 0,
    caseSensitive: false,
    isOpen: false,
  })

  const mockContent = `# Mock 内容注入

这是一次 \`setContent\` API 的模拟调用，用于测试动态内容替换功能。

## 功能验证
- 内容替换是否正常
- 编辑器状态是否正确更新
- 撤销/重做是否正常

> 提示：此内容通过 editorRef.current.setContent() 注入
`

  const debounceChange = debounce((params) => {
    setContent(editorDelegate.docToString(params.state.doc) || '')
  }, 300)

  const performFind = useCallback(
    (indexDiff = 0) => {
      if (!editorRef.current || !findState.query) return

      try {
        const helpers = editorCtxRef.current?.helpers

        if (helpers?.findRanges) {
          const result = helpers.findRanges({
            query: findState.query,
            caseSensitive: findState.caseSensitive,
            activeIndex: findState.activeIndex == null ? 0 : findState.activeIndex + indexDiff,
          })
          setFindState((prev) => ({
            ...prev,
            total: result.ranges.length,
            activeIndex: result.activeIndex ?? 0,
          }))
        }
      } catch (e) {
        console.error('Error performing find:', e)
      }
    },
    [findState.query, findState.caseSensitive, findState.activeIndex],
  )

  const findNext = useCallback(() => {
    performFind(1)
  }, [performFind])

  const findPrev = useCallback(() => {
    performFind(-1)
  }, [performFind])

  const stopFind = useCallback(() => {
    setFindState((prev) => ({ ...prev, isOpen: false, query: '', activeIndex: null, total: 0 }))
    try {
      const commands = editorCtxRef.current?.commands
      if (commands?.stopFind) {
        commands.stopFind()
      }
    } catch (e) {
      console.error('Error stopping find:', e)
    }
  }, [])

  const mockSetContent = useCallback(() => {
    setContent(mockContent)
    editorRef.current?.setContent(mockContent)
  }, [mockContent, setContent])

  const replace = useCallback(() => {
    if (!findState.query) return

    try {
      const commands = editorCtxRef.current?.commands
      if (commands?.findAndReplace) {
        commands.findAndReplace({
          query: findState.query,
          replacement: findState.replacement,
          caseSensitive: findState.caseSensitive,
          index: findState.activeIndex ?? undefined,
        })

        const isQuerySubsetOfReplacement = findState.caseSensitive
          ? findState.replacement.includes(findState.query)
          : findState.replacement.toLowerCase().includes(findState.query.toLowerCase())

        if (isQuerySubsetOfReplacement) {
          setTimeout(findNext, 100)
        } else {
          setTimeout(performFind, 100)
        }
      }
    } catch (e) {
      console.error('Error performing replace:', e)
    }
  }, [findState, findNext, performFind])

  const replaceAll = useCallback(() => {
    if (!findState.query) return

    try {
      const commands = editorCtxRef.current?.commands
      if (commands?.findAndReplaceAll) {
        commands.findAndReplaceAll({
          query: findState.query,
          replacement: findState.replacement,
          caseSensitive: findState.caseSensitive,
        })
        setTimeout(stopFind, 100)
      }
    } catch (e) {
      console.error('Error performing replace all:', e)
    }
  }, [findState, stopFind])

  const handleEditorTypeChange = useCallback(
    (type: EditorType) => {
      setEditorType(type)
      if (type === 'wysiwyg') {
        setEditorDelegate(createAppWysiwygDelegate())
        editorRef.current?.toggleType(EditorViewType.WYSIWYG)
      } else if (type === 'sourceCode') {
        setEditorDelegate(
          createSourceCodeDelegate({
            disableAllBuildInShortcuts: true,
            overrideShortcutMap: {
              copy: 'mod-c',
              cut: 'mod-x',
              paste: 'mod-Shift-1',
              redo: 'mod-Shift-z',
              toggleCodeText: 'mod-e',
              toggleDelete: 'mod-Shift-s',
              toggleEmphasis: 'mod-i',
              insertCurrentDate: 'mod-;',
              toggleH1: 'mod-1',
              toggleH2: 'mod-2',
              toggleH3: 'mod-3',
              toggleH4: 'mod-4',
              toggleH5: 'mod-5',
              toggleH6: 'mod-6',
              toggleStrong: 'mod-b',
              undo: 'mod-z',
            },
            onCodemirrorViewLoad: (cmNodeView) => {
              extractMatches(cmNodeView.cm)
              console.log('cmNodeView', cmNodeView)
            },
          }),
        )
        editorRef.current?.toggleType(EditorViewType.SOURCECODE)
      } else {
        editorRef.current?.toggleType(EditorViewType.PREVIEW)
      }
    },
    [setEditorType, setEditorDelegate],
  )

  const handleTypewriterScrollChange = useCallback(
    (enabled: boolean) => {
      setEnableTypewriterScroll(enabled)
      // Use command to dynamically toggle typewriter scroll
      try {
        const commands = editorCtxRef.current?.commands
        if (commands?.toggleTypewriterScroll) {
          commands.toggleTypewriterScroll(enabled)
        }
      } catch (e) {
        console.error('Error toggling typewriter scroll:', e)
      }
    },
    [setEnableTypewriterScroll],
  )

  // Sync typewriter scroll state when editor context is mounted or state changes
  React.useEffect(() => {
    if (editorCtxRef.current?.commands) {
      try {
        const commands = editorCtxRef.current.commands
        if (commands.toggleTypewriterScroll) {
          commands.toggleTypewriterScroll(enableTypewriterScroll)
        }
      } catch (e) {
        console.error('Error syncing typewriter scroll state:', e)
      }
    }
  }, [enableTypewriterScroll, editorCtxRef.current?.commands])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setConfigPanelOpen(true)
        setFindState((prev) => ({ ...prev, isOpen: true }))
      } else if (e.key === 'Escape') {
        setFindState((prev) => ({ ...prev, isOpen: false }))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const editor = (
    <div className="playground-self-scroll">
      <Editor
        initialType={EditorViewType.WYSIWYG}
        key={contentId}
        delegate={editorDelegate}
        ref={editorRef}
        content={content}
        onChange={debounceChange}
        isTesting={false}
        onContextMounted={(context) => {
          editorCtxRef.current = context
        }}
        wysiwygToolBarOptions={{
          enable: true,
        }}
        blockHandlerOptions={{
          getMenuBoundary: (editorView) =>
            editorView.dom.closest<HTMLElement>('.playground-self-scroll'),
        }}
      />
    </div>
  )

  const debugConsole = enableDevTools ? (
    <div className="playground-self-scroll">
      <DebugConsole
        hasUnsavedChanges={hasUnsavedChanges}
        contentId={contentId}
        content={content}
        setContentId={setContentId}
      />
    </div>
  ) : null

  const BlurHelper: FC = () => {
    return (
      <button
        className="blur-helper"
        style={{
          position: 'absolute',
          bottom: '64px',
          right: '64px',
          opacity: 0,
        }}
      ></button>
    )
  }

  const themeData = {
    mode: theme,
  }

  return (
    <main className={theme === 'dark' ? 'dark-theme' : 'light-theme'}>
      <ZThemeProvider theme={themeData}>
        <div className="playground-header">
          <div className="playground-header-left">
            <h1 className="playground-title">
              <span className="playground-logo">◈</span>
              MARKFLOWY
            </h1>
            <span className="playground-subtitle">WYSIWYG Markdown Editor</span>
          </div>
          <div className="playground-header-actions">
            <span className={`playground-header-badge ${editorType === 'wysiwyg' ? 'active' : ''}`}>
              {editorType.toUpperCase()}
            </span>
            <span className={`playground-header-badge ${theme === 'dark' ? 'active' : ''}`}>
              {theme === 'dark' ? '☾ DARK' : '☀ LIGHT'}
            </span>
          </div>
        </div>
        <ThemeProvider
          theme={themeData}
          i18n={{
            locales: {
              'zh-CN': {
                translation: {
                  table: {
                    insertColumnAfter: '向后插入列',
                    insertColumnBefore: '向前插入列',
                    insertRowAfter: '向后插入行',
                    insertRowBefore: '向前插入行',
                    deleteColumn: '删除列',
                    deleteRow: '删除行',
                  },
                },
              },
            },
            language: 'zh-CN',
          }}
        >
          <DebugButton
            enableDevTools={enableDevTools}
            toggleEnableDevTools={() => setEnableDevTools(!enableDevTools)}
          />
          <ConfigTrigger isOpen={configPanelOpen} onClick={() => setConfigPanelOpen(!configPanelOpen)} />
          <ConfigPanel
            isOpen={configPanelOpen}
            onClose={() => setConfigPanelOpen(false)}
            editorType={editorType}
            onEditorTypeChange={handleEditorTypeChange}
            theme={theme}
            onThemeChange={setTheme}
            enableDevTools={enableDevTools}
            onDevToolsChange={setEnableDevTools}
            enableTypewriterScroll={enableTypewriterScroll}
            onTypewriterScrollChange={handleTypewriterScrollChange}
            findState={findState}
            onFindStateChange={setFindState}
            onFindNext={findNext}
            onFindPrev={findPrev}
            onReplace={replace}
            onReplaceAll={replaceAll}
            onPerformFind={performFind}
            onStopFind={stopFind}
            onMockSetContent={mockSetContent}
          />
          <div className="playground-box">
            {editor}
            {debugConsole}
          </div>
          <BlurHelper />
        </ThemeProvider>
      </ZThemeProvider>
    </main>
  )
}

export default App
