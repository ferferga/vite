import fs from 'node:fs'
import path from 'node:path'

function patchFile(filePath, patcher) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const newContent = patcher(content)
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent)
    console.log(`Patched ${filePath}`)
  } else {
    console.log(`No changes for ${filePath}`)
  }
}

// --- packages/vite/src/node/config.ts ---
patchFile('packages/vite/src/node/config.ts', (content) => {
  if (!content.includes('shareChunks: boolean')) {
    content = content.replace(
      'rolldownOptions: RolldownOptions',
      'rolldownOptions: RolldownOptions\n  shareChunks: boolean\n  shareChunkOnInline: boolean',
    )
  }
  if (!content.includes('shareChunks?: boolean')) {
    content = content.replace(
      'rolldownOptions?: Omit<',
      "/**\n     * Whether to share chunks between the worker and the main bundle.\n     * Only works when `format` is 'es'.\n     * @default true\n     */\n    shareChunks?: boolean\n    /**\n     * Whether to share chunks between the inline worker and the main bundle.\n     * Only works when `format` is 'es'.\n     * @default false\n     */\n    shareChunkOnInline?: boolean\n    rolldownOptions?: Omit<",
    )
  }
  if (!content.includes('shareChunks: config.worker?.shareChunks ?? true')) {
    content = content.replace(
      'rolldownOptions: config.worker?.rolldownOptions,',
      'rolldownOptions: config.worker?.rolldownOptions,\n    shareChunks: config.worker?.shareChunks ?? true,\n    shareChunkOnInline: config.worker?.shareChunkOnInline ?? false,',
    )
  }
  return content
})

// --- packages/vite/src/node/plugins/worker.ts ---
patchFile('packages/vite/src/node/plugins/worker.ts', (content) => {
  // Export inlineRE
  content = content.replace(
    'const inlineRE = /[?&]inline\\b/',
    'export const inlineRE: RegExp = /[?&]inline\\b/',
  )

  // Add workerChunkUrlRE
  if (!content.includes('export const workerChunkUrlRE')) {
    content = content.replace(
      'export const workerAssetUrlRE: RegExp = /__VITE_WORKER_ASSET__([a-z\\d]{8})__/g',
      'export const workerAssetUrlRE: RegExp = /__VITE_WORKER_ASSET__([a-z\\d]{8})__/g\nexport const workerChunkUrlRE: RegExp = /__VITE_WORKER_CHUNK__([\\w$]+)__/g',
    )
  }

  // Add shareChunks logic in load hook
  if (!content.includes('config.worker.shareChunks')) {
    const oldLoad = `            urlCode = JSON.stringify(url)
            for (const file of result.watchedFiles) {
              this.addWatchFile(file)
            }
          }
        } else {`
    const newLoad = `            urlCode = JSON.stringify(url)
            for (const file of result.watchedFiles) {
              this.addWatchFile(file)
            }
          }
        } else if (
          this.environment.config.command === 'build' &&
          format === 'es' &&
          config.worker.shareChunks &&
          (!inlineRE.test(id) || config.worker.shareChunkOnInline)
        ) {
          const fileName = this.emitFile({
            type: 'chunk',
            id: cleanUrl(id),
          })
          urlCode = "__VITE_WORKER_CHUNK__" + fileName + "__"
        } else {`
    content = content.replace(oldLoad, newLoad)
  }

  // Update renderChunk hook
  const renderChunkReplacement = `          renderChunk(code, chunk, outputOptions) {
            let s: MagicString | undefined
            const result = () => {
              return (
                s && {
                  code: s.toString(),
                  map: this.environment.config.build.sourcemap
                    ? s.generateMap({ hires: 'boundary' })
                    : null,
                }
              )
            }

            const toRelativeRuntime = () =>
              createToImportMetaURLBasedRelativeRuntime(
                outputOptions.format,
                this.environment.config.isWorker,
              )

            workerAssetUrlRE.lastIndex = 0
            if (workerAssetUrlRE.test(code)) {
              let match: RegExpExecArray | null
              s = new MagicString(code)
              workerAssetUrlRE.lastIndex = 0

              // Replace "__VITE_WORKER_ASSET__5aa0ddc0__" using relative paths
              const workerOutputCache = workerOutputCaches.get(
                config.mainConfig || config,
              )!

              while ((match = workerAssetUrlRE.exec(code))) {
                const [full, hash] = match
                const filename =
                  workerOutputCache.getEntryFilenameFromHash(hash)
                if (!filename) {
                  this.warn(\`Could not find worker asset for hash: \${hash}\`)
                  continue
                }
                const replacement = toOutputFilePathInJS(
                  this.environment,
                  filename,
                  'asset',
                  chunk.fileName,
                  'js',
                  toRelativeRuntime(),
                )
                const replacementString =
                  typeof replacement === 'string'
                    ? JSON.stringify(encodeURIPath(replacement)).slice(1, -1)
                    : \`"+\${replacement.runtime}+"\`
                s.update(
                  match.index,
                  match.index + full.length,
                  replacementString,
                )
              }
            }

            workerChunkUrlRE.lastIndex = 0
            if (workerChunkUrlRE.test(code)) {
              let match: RegExpExecArray | null
              s ||= new MagicString(code)
              workerChunkUrlRE.lastIndex = 0

              while ((match = workerChunkUrlRE.exec(code))) {
                const [full, referenceId] = match
                const filename = this.getFileName(referenceId)
                const replacement = toOutputFilePathInJS(
                  this.environment,
                  filename,
                  'asset',
                  chunk.fileName,
                  'js',
                  toRelativeRuntime(),
                )

                let replacementString
                if (typeof replacement === 'string') {
                  // Prepend base manually if it's absolute to ensure it works in preview
                  // Actually toOutputFilePathInJS should already do it if base is set.
                  // But let's wrap it in new URL().href for maximum robustness if it's relative
                   replacementString = \`new URL(\${JSON.stringify(encodeURIPath(replacement))}, import.meta.url).href\`
                } else {
                  replacementString = \`new URL("+\${replacement.runtime}+", import.meta.url).href\`
                }

                s.update(
                  match.index,
                  match.index + full.length,
                  replacementString,
                )
              }
            }
            return result()
          },`

  const pattern =
    /renderChunk\(code, chunk, outputOptions\) \{.*?return result\(\)\s*\},/s
  content = content.replace(pattern, renderChunkReplacement)

  return content
})

// --- packages/vite/src/node/plugins/workerImportMetaUrl.ts ---
patchFile(
  'packages/vite/src/node/plugins/workerImportMetaUrl.ts',
  (content) => {
    if (!content.includes('inlineRE')) {
      content = content.replace(
        "import { WORKER_FILE_ID, workerFileToUrl } from './worker'",
        "import { WORKER_FILE_ID, workerFileToUrl, inlineRE } from './worker'",
      )
    }

    if (!content.includes('config.worker.shareChunks')) {
      const oldIMU =
        /if\s*\(\s*isBundled &&\s*config\.isWorker &&\s*config\.bundleChain\.at\(-1\) === cleanUrl\(file\)\s*\)\s*\{\s*s\.update\(expStart, expEnd, 'self\.location\.href'\)\s*\}\s*else\s*\{/s
      const newIMU = `if (
            isBundled &&
            config.isWorker &&
            config.bundleChain.at(-1) === cleanUrl(file)
          ) {
            s.update(expStart, expEnd, 'self.location.href')
          } else if (
            isBundled &&
            this.environment.config.command === 'build' &&
            workerType === 'module' &&
            config.worker.format === 'es' &&
            config.worker.shareChunks &&
            (!inlineRE.test(file) || config.worker.shareChunkOnInline)
          ) {
            const fileName = this.emitFile({
              type: 'chunk',
              id: cleanUrl(file),
            })
            s.update(
              expStart,
              expEnd,
              "__VITE_WORKER_CHUNK__" + fileName + "__",
            )
          } else {`
      content = content.replace(oldIMU, newIMU)
    }
    return content
  },
)

// --- playground opt-outs ---
patchFile('playground/worker/vite.config-es.js', (content) => {
  if (!content.includes('shareChunks: false')) {
    return content.replace(
      "format: 'es',",
      "format: 'es',\n    shareChunks: false,",
    )
  }
  return content
})
patchFile('playground/worker/vite.config-relative-base.js', (content) => {
  if (!content.includes('shareChunks: false')) {
    return content.replace(
      "format: 'es',",
      "format: 'es',\n    shareChunks: false,",
    )
  }
  return content
})
