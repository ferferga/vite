import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { isBuild, page, testDir } from '~utils'

test('runtime', async () => {
  await expect
    .poll(() => page.textContent('.main-res'))
    .toMatch('main:shared-data')
  await expect
    .poll(() => page.textContent('.worker1-res'))
    .toMatch('worker1:shared-data')
  await expect
    .poll(() => page.textContent('.worker2-res'))
    .toMatch('worker2:shared-data')
  await expect
    .poll(() => page.textContent('.inline-worker-res'))
    .toMatch('inline-worker:shared-data')
})

describe.runIf(isBuild)('build', () => {
  test('should extract shared dependencies into common chunks', async () => {
    const assetsDir = path.resolve(testDir, 'dist/assets')
    const files = fs.readdirSync(assetsDir)

    const worker1 = files.find((f) => f.startsWith('worker1'))
    const worker2 = files.find((f) => f.startsWith('worker2'))
    const index = files.find((f) => f.startsWith('index'))
    const shared = files.find((f) => f.startsWith('shared'))

    expect(worker1).toBeDefined()
    expect(worker2).toBeDefined()
    expect(index).toBeDefined()
    expect(shared).toBeDefined()

    const content1 = fs.readFileSync(path.resolve(assetsDir, worker1!), 'utf-8')
    const content2 = fs.readFileSync(path.resolve(assetsDir, worker2!), 'utf-8')
    const contentIndex = fs.readFileSync(
      path.resolve(assetsDir, index!),
      'utf-8',
    )

    // All entries should import the shared module
    expect(content1).toMatch(/import.*from\s*"\.\/shared/)
    expect(content2).toMatch(/import.*from\s*"\.\/shared/)
    expect(contentIndex).toMatch(/import.*from\s*"\.\/shared/)
  })

  test('inline worker should be self-contained by default', async () => {
    const assetsDir = path.resolve(testDir, 'dist/assets')
    const files = fs.readdirSync(assetsDir)
    const index = files.find((f) => f.startsWith('index'))
    const contentIndex = fs.readFileSync(
      path.resolve(assetsDir, index!),
      'utf-8',
    )

    expect(contentIndex).toContain('Blob')
    expect(contentIndex).toContain('shared-data')
  })
})
