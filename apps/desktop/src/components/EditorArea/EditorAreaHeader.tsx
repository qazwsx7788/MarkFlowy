import bus from '@/helper/eventBus'
import { getFileObject, getSaveOpenedEditorEntries } from '@/helper/files'
import { dialog } from '@/services/dialog'
import { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { addEmptyEditorTab } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import { useEditorStateStore, useEditorStore } from '@/stores'
import { memo, useCallback, useRef, useState } from 'react'
import { useTranslation } from '@/i18n'
import { toast } from 'zens'
import { MfIconButton } from '../ui-v2/Button'
import { showContextMenu } from '../ui-v2/ContextMenu'

export const EditorAreaHeader = memo(() => {
  const { opened, activeId, getEditorDelegate, delAllOpenedFile } = useEditorStore()
  const { idStateMap } = useEditorStateStore()
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [refreshing, setRefreshing] = useState(false)
  const curFile = activeId ? getFileObject(activeId) : undefined

  const handleClick = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect === undefined) return

    showContextMenu({
      x: rect.x,
      y: rect.y + rect.height,
      items: [
        {
          label: t('contextmenu.editor_tab.close_all'),
          value: 'close_all',
          handler: () => {
            if (
              checkUnsavedFiles({
                fileIds: opened,
                onSaveAndClose: async (hasUnsavedFileIds) => {
                  const saves = hasUnsavedFileIds.map((otherId) =>
                    getSaveOpenedEditorEntries(otherId),
                  )
                  await Promise.all(saves.map((saveHandler) => saveHandler?.()))
                  delAllOpenedFile()
                },
                onUnsavedAndClose: () => {
                  delAllOpenedFile()
                },
              }) > 0
            ) {
              return
            }
            delAllOpenedFile()
          },
        },
      ],
    })
  }, [curFile, getEditorDelegate])

  const handleRefresh = useCallback(async () => {
    if (!activeId || !curFile) return
    if (!curFile.path) {
      toast.info(t('contextmenu.editor_tab.refresh_no_path'))
      return
    }

    const hasUnsaved = idStateMap.get(activeId)?.hasUnsavedChanges
    if (hasUnsaved) {
      const action = await dialog.confirm({
        title: t('confirm.refresh.title'),
        content: t('confirm.refresh.description'),
        actions: [
          { id: 'refresh', label: t('contextmenu.editor_tab.refresh'), primary: true, danger: true },
          { id: 'cancel', label: t('common.cancel') },
        ],
      })
      if (action !== 'refresh') return
    }

    setRefreshing(true)
    try {
      const content = await getFileContent({ filePath: curFile.path })
      if (content === null) {
        toast.error(t('file.not_found'))
        return
      }
      bus.emit('editor_set_content', undefined, content)
      useEditorStateStore.getState().setIdStateMap(activeId, { hasUnsavedChanges: false })
      toast.success(t('contextmenu.editor_tab.refresh_success'))
    } catch (error) {
      toast.error(String(error))
    } finally {
      setRefreshing(false)
    }
  }, [activeId, curFile, idStateMap, t])

  return (
    <div className='editor-area-header'>
      <MfIconButton icon={'ri-add-line'} onClick={addEmptyEditorTab} />
      {curFile ? (
        <>
          <MfIconButton
            icon={refreshing ? 'ri-loader-4-line' : 'ri-refresh-line'}
            className={refreshing ? 'icon-rotate' : undefined}
            disabled={refreshing}
            tooltipProps={{ title: t('contextmenu.editor_tab.refresh') }}
            onClick={handleRefresh}
          />
          <MfIconButton iconRef={ref} icon={'ri-more-2-fill'} onClick={handleClick} />
        </>
      ) : null}
    </div>
  )
})
