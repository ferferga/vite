import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { isBuild, testDir } from '~utils'

describe.runIf(isBuild)('build (shared chunks)', () => {
  test('verify chunks are shared and not bundled in worker files', () => {
    const assetsDir = path.resolve(testDir, 'dist/shared-chunks/assets')
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir)
      console.log('Built files:', files)
      const myWorkerFile = files.find(
        (f) => f.startsWith('my-worker-') && f.endsWith('.js'),
      )
      expect(myWorkerFile).toBeDefined()

      const fileContent = fs.readFileSync(
        path.resolve(assetsDir, myWorkerFile!),
        'utf-8',
      )
      console.log('my-worker file content:', fileContent)
      // Expect that my-worker imports the shared-worker-import-chunk
      expect(fileContent).toMatch(/import.*shared-worker-import-chunk/)
    }
  })
})
