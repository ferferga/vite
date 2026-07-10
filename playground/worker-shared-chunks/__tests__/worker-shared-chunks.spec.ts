import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { isBuild, page, testDir } from '~utils'

test('runtime', async () => {
  await expect.poll(() => page.textContent('.main-res')).toMatch('main:shared-data')
  await expect.poll(() => page.textContent('.worker1-res')).toMatch('worker1:shared-data')
  await expect.poll(() => page.textContent('.worker2-res')).toMatch('worker2:shared-data')
  await expect.poll(() => page.textContent('.inline-worker-res')).toMatch('inline-worker:shared-data')
})

describe.runIf(isBuild)('build', () => {
  test('should extract shared dependencies into common chunks', async () => {
    const assetsDir = path.resolve(testDir, 'dist/assets')
    const files = fs.readdirSync(assetsDir)

    // Check if shared chunk exists
    const sharedChunk = files.find(f => f.startsWith('shared-'))
    expect(sharedChunk).toBeDefined()

    const worker1 = files.find(f => f.startsWith('worker1-'))
    const worker2 = files.find(f => f.startsWith('worker2-'))

    expect(worker1).toBeDefined()
    expect(worker2).toBeDefined()

    const content1 = fs.readFileSync(path.resolve(assetsDir, worker1!), 'utf-8')
    const content2 = fs.readFileSync(path.resolve(assetsDir, worker2!), 'utf-8')

    // Both workers should import the shared chunk
    expect(content1).toMatch(/import.*from\s*"\.\/shared-/)
    expect(content2).toMatch(/import.*from\s*"\.\/shared-/)
  })
})
