import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { isBuild, page, testDir } from '~utils'

test('runtime', async () => {
  await expect.poll(() => page.textContent('.main-res')).toMatch('main:shared-data')
  await expect.poll(() => page.textContent('.worker1-res')).toMatch('worker1:shared-data')
  await expect.poll(() => page.textContent('.worker2-res')).toMatch('worker2:shared-data')
})

describe.runIf(isBuild)('build', () => {
  test('should extract shared dependencies into common chunks', async () => {
    const assetsDir = path.resolve(testDir, 'dist/assets')
    const files = fs.readdirSync(assetsDir)

    // Check if shared chunk exists
    const sharedChunk = files.find((f) => f.includes('shared-chunk-'))
    expect(sharedChunk).toBeDefined()

    // Both workers should exist
    const worker1 = files.find((f) => f.includes('worker1-'))
    const worker2 = files.find((f) => f.includes('worker2-'))

    expect(worker1).toBeDefined()
    expect(worker2).toBeDefined()
  })
})
