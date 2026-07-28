import fs from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import type { OutputChunk, RolldownOutput } from 'rolldown'
import { build } from '../../build'

const fixturesDir = resolve(import.meta.dirname, 'fixtures')

test('?worker&url should produce the same hash in client and SSR builds', async () => {
  const root = resolve(fixturesDir, 'worker-url')

  const clientResult = (await build({
    root,
    logLevel: 'silent',
    build: {
      write: false,
      rolldownOptions: {
        input: resolve(root, 'entry.js'),
      },
    },
  })) as RolldownOutput

  const ssrResult = (await build({
    root,
    logLevel: 'silent',
    build: {
      write: false,
      ssr: resolve(root, 'entry.js'),
    },
  })) as RolldownOutput

  // Extract the worker URL from both builds.
  // The entry chunk will contain the worker asset URL as a string.
  const clientEntry = clientResult.output.find(
    (o): o is OutputChunk => o.type === 'chunk' && o.isEntry,
  )!
  const ssrEntry = ssrResult.output.find(
    (o): o is OutputChunk => o.type === 'chunk' && o.isEntry,
  )!

  const workerUrlPattern = /assets\/worker-[\w-]+\.js/g
  const clientWorkerUrls = clientEntry.code.match(workerUrlPattern) ?? []
  const ssrWorkerUrls = ssrEntry.code.match(workerUrlPattern) ?? []

  expect(clientWorkerUrls.length).toBeGreaterThan(0)
  expect(ssrWorkerUrls.length).toBeGreaterThan(0)
  expect(ssrWorkerUrls).toEqual(clientWorkerUrls)
})

test('shared dependencies between main bundle and worker should be split into shared chunks in format es', async () => {
  const root = resolve(fixturesDir, 'worker-share-chunk')

  const result = (await build({
    root,
    logLevel: 'silent',
    worker: {
      format: 'es',
    },
    build: {
      write: false,
      rolldownOptions: {
        input: resolve(root, 'entry.js'),
      },
    },
  })) as RolldownOutput

  const chunks = result.output.filter((o): o is OutputChunk => o.type === 'chunk')

  const mainChunk = chunks.find((c) => c.isEntry && c.fileName.includes('entry'))!
  const workerChunk = chunks.find((c) => c.fileName.includes('worker'))!
  const sharedChunk = chunks.find((c) => !c.isEntry && c.fileName.includes('shared-dep'))!

   expect(mainChunk).toBeDefined()
  expect(workerChunk).toBeDefined()
  expect(sharedChunk).toBeDefined()

  // Verify that the worker chunk imports from the shared dependency chunk and does not inline it
  expect(workerChunk.code).toContain('import')
  expect(workerChunk.code).not.toContain('shared dependency!')

  // Verify output paths: ensure the import statement filename in both main chunk and worker chunk
  // matches the real chunk filename of the shared chunk.
  const sharedChunkBaseName = sharedChunk.fileName.split('/').pop()!
  expect(mainChunk.code).toContain(sharedChunkBaseName)
  expect(workerChunk.code).toContain(sharedChunkBaseName)
})

test('shared chunk on inline workers with shareChunkOnInline: true', async () => {
  const root = resolve(fixturesDir, 'worker-share-chunk')

  // Create an entry that uses inline worker
  const entryInlineContent = `
    import MyWorker from "./worker?worker&inline"
    import { sharedFn } from "./shared-dep"
    console.log(MyWorker, sharedFn)
  `
  fs.writeFileSync(resolve(root, 'entry-inline.js'), entryInlineContent, 'utf-8')

  try {
    const result = (await build({
      root,
      logLevel: 'silent',
      worker: {
        format: 'es',
        shareChunkOnInline: true,
      },
      build: {
        write: false,
        rolldownOptions: {
          input: resolve(root, 'entry-inline.js'),
        },
      },
    })) as RolldownOutput

    const chunks = result.output.filter((o): o is OutputChunk => o.type === 'chunk')

    const mainChunk = chunks.find((c) => c.isEntry && c.fileName.includes('entry-inline'))!
    const workerChunk = chunks.find((c) => c.fileName.includes('worker'))!
    const sharedChunk = chunks.find((c) => !c.isEntry && c.fileName.includes('shared-dep'))!

    expect(mainChunk).toBeDefined()
    expect(workerChunk).toBeDefined()
    expect(sharedChunk).toBeDefined()

    expect(workerChunk.code).toContain('import')
    expect(workerChunk.code).not.toContain('shared dependency!')

    const sharedChunkBaseName = sharedChunk.fileName.split('/').pop()!
    expect(mainChunk.code).toContain(sharedChunkBaseName)
    expect(workerChunk.code).toContain(sharedChunkBaseName)
  } finally {
    try {
      fs.unlinkSync(resolve(root, 'entry-inline.js'))
    } catch {}
  }
})
