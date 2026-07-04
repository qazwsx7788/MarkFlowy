import { sleep } from '@/helper'
import { clipboardRead } from '@/helper/clipboard'
import { getFileObject } from '@/helper/files'
import { getFolderPathFromPath } from '@/helper/filesys'
import { getImageUrlInTauri } from '@/helper/image'
import { logger } from '@/helper/logger'
import { useEditorKeybindingStore } from '@/hooks/useKeyboard'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { CreateWysiwygDelegateOptions } from 'rme'
import { handleUploadImage, handleImagePaste } from './imageHandlers'

export const getCurrentEditorInsertDateFormat = () => {
  return useAppSettingStore.getState().settingData.editor_insert_date_format as string | undefined
}

export const createWysiwygDelegateOptions = (fileId?: string): CreateWysiwygDelegateOptions => {
  const settingData = useAppSettingStore.getState().settingData

  return {
    disableAllBuildInShortcuts: true,
    overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
    codemirrorOptions: {
      lineWrapping: settingData.wysiwyg_editor_codemirror_line_wrap,
    },
    typewriterScroll: {
      enabled: settingData.editor_typewriter_scroll,
    },
    currentDateFormat: getCurrentEditorInsertDateFormat,
    placeholder: {
      enabled: settingData.editor_placeholder,
    },
    clipboardReadFunction: clipboardRead,
    uploadImageHandler: (files) => handleUploadImage(files, fileId),
    imagePasteHandler: (src) => handleImagePaste(src, fileId),
    handleViewImgSrcUrl: async (url) => {
      await sleep(1)

      try {
        const decodedUrl = decodeURIComponent(url)
        const file = fileId ? getFileObject(fileId) : null
        const fileFolderPath = getFolderPathFromPath(file?.path)

        const src = await getImageUrlInTauri(decodedUrl, fileFolderPath)
        return src
      } catch (error) {
        logger.error('Failed to get image URL:', error)
      }
      return url
    },
    customCopyFunction: async (text) => {
      try {
        await writeText(text)
        return true
      } catch (error) {
        return false
      }
    },
    handleLinkClick: (href) => {
      openUrl(href)
      return true
    },
  }
}
