import { describe, it, expect, vi } from 'vitest'

vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({ getRootPath: () => '' }),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('rme', () => ({}))

vi.mock('antd', () => ({}))

vi.mock('@markflowy/interface', () => ({
  FileResultCode: { Success: 0 },
}))

vi.mock('../files', () => ({
  getFileObjectByPath: vi.fn(),
  setFileObject: vi.fn(),
  setFileObjectByPath: vi.fn(),
}))

import { fileUrlToPath, getFileNameFromPath, getFolderPathFromPath, isMdFile } from '../filesys'

describe('test helper/filesys ', () => {
  it('getFileNameFromPath', () => {
    const macPath = '/path/to/myfile.txt'
    const winPath = 'C:\\path\\to\\myfile.txt'

    expect(getFileNameFromPath(macPath)).toBe('myfile.txt')
    expect(getFileNameFromPath(winPath)).toBe('myfile.txt')
  })

  it('isMdFile', () => {
    const macPath = '/path/to/myfile.md'
    const winPath = 'C:\\path\\to\\myfile.md'
    const otherPath = 'C:\\path\\to\\myfile.txt'

    expect(isMdFile(macPath)).toBe(true)
    expect(isMdFile(winPath)).toBe(true)
    expect(isMdFile(otherPath)).toBe(false)
  })

  it('getFolderPathFromPath', () => {
    const macPath = '/path/to/myfile.txt'
    const winPath = 'C:\\path\\to\\myfile.txt'

    expect(getFolderPathFromPath(macPath)).toBe('/path/to')
    expect(getFolderPathFromPath(winPath)).toBe('C:\\path\\to')
  })

  describe('fileUrlToPath', () => {
    it('converts a Windows UNC (WSL) file URL to a UNC path', () => {
      expect(fileUrlToPath('file://wsl.localhost/Ubuntu-22.04/home/ysd/note.md')).toBe(
        '\\\\wsl.localhost\\Ubuntu-22.04\\home\\ysd\\note.md',
      )
    })

    it('converts a Windows drive-letter file URL to a backslash path', () => {
      expect(fileUrlToPath('file:///C:/Users/ysd/note.md')).toBe('C:\\Users\\ysd\\note.md')
    })

    it('converts a unix file URL to a posix path', () => {
      expect(fileUrlToPath('file:///home/ysd/note.md')).toBe('/home/ysd/note.md')
    })

    it('returns bare (non-file://) paths unchanged', () => {
      expect(fileUrlToPath('\\\\wsl.localhost\\share\\file.md')).toBe('\\\\wsl.localhost\\share\\file.md')
      expect(fileUrlToPath('C:\\Users\\ysd\\note.md')).toBe('C:\\Users\\ysd\\note.md')
      expect(fileUrlToPath('/home/ysd/note.md')).toBe('/home/ysd/note.md')
    })

    it('percent-decodes the path', () => {
      expect(fileUrlToPath('file:///home/ysd/a%20b.md')).toBe('/home/ysd/a b.md')
    })
  })
})
