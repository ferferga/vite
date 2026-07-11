import fs from 'node:fs'

function patchFile(filePath, search, replace) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const newContent = content.replace(search, replace)
  fs.writeFileSync(filePath, newContent)
  console.log(`Patched ${filePath}`)
}

// 1. CONFIG (Assuming it's already mostly correct, but let's be sure)
// It's already done and typechecked, so I'll leave it.

// 2. WORKER
let workerContent = fs.readFileSync('packages/vite/src/node/plugins/worker.ts', 'utf-8')

// Ensure inlineRE is exported
if (!workerContent.includes('export const inlineRE: RegExp =')) {
  workerContent = workerContent.replace('const inlineRE =', 'export const inlineRE: RegExp =')
}

// Remove any leftover workerChunkUrlRE or my bad renderChunk
workerContent = workerContent.replace('\nexport const workerChunkUrlRE: RegExp = /__VITE_WORKER_CHUNK__([\\w$!~%\\\\{\\\\}\\\\d]+)__/g', '')
// Revert renderChunk to original state if I messed it up
const originalRenderChunk = `          renderChunk(code, chunk, outputOptions) {
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

            workerAssetUrlRE.lastIndex = 0
            if (workerAssetUrlRE.test(code)) {
              let match: RegExpExecArray | null
              s = new MagicString(code)
              workerAssetUrlRE.lastIndex = 0

              // Replace "__VITE_WORKER_ASSET__5aa0ddc0__" using relative paths
              const workerOutputCache = workerOutputCaches.get(
                config.mainConfig || config,
              )!
              const toRelativeRuntime = createToImportMetaURLBasedRelativeRuntime(
                outputOptions.format,
                this.environment.config.isWorker,
              )

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
                  toRelativeRuntime,
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
            return result()
          },`

// I'll just replace the whole renderChunk block to be sure
const renderChunkPattern = /renderChunk\(code, chunk, outputOptions\) \{.*?return result\(\)\s*\},/s
workerContent = workerContent.replace(renderChunkPattern, originalRenderChunk)

// Use import.meta.ROLLUP_FILE_URL_ in load hook
const loadSearch = `        } else if (
          this.environment.config.command === 'build' &&
          format === 'es' &&
          config.worker.shareChunks &&
          (!inlineRE.test(id) || config.worker.shareChunkOnInline)
        ) {
          const referenceId = this.emitFile({
            type: 'chunk',
            id: cleanUrl(id),
          })
          urlCode = '__VITE_WORKER_CHUNK__' + referenceId + '__'
        } else {`

const loadReplace = `        } else if (
          this.environment.config.command === 'build' &&
          format === 'es' &&
          config.worker.shareChunks &&
          (!inlineRE.test(id) || config.worker.shareChunkOnInline)
        ) {
          const referenceId = this.emitFile({
            type: 'chunk',
            id: cleanUrl(id),
          })
          urlCode = "import.meta.ROLLUP_FILE_URL_" + referenceId
        } else {`

workerContent = workerContent.replace(loadSearch, loadReplace)
// Also handle the case where I might have already partially changed it
workerContent = workerContent.replace("urlCode = '__VITE_WORKER_CHUNK__' + referenceId + '__'", 'urlCode = "import.meta.ROLLUP_FILE_URL_" + referenceId')

fs.writeFileSync('packages/vite/src/node/plugins/worker.ts', workerContent)

// 3. WORKER IMU
let imuContent = fs.readFileSync('packages/vite/src/node/plugins/workerImportMetaUrl.ts', 'utf-8')
const imuSearch = `          } else if (
            isBundled &&
            this.environment.config.command === 'build' &&
            workerType === 'module' &&
            config.worker.format === 'es' &&
            config.worker.shareChunks &&
            (!/[?&]inline\\b/.test(file) || config.worker.shareChunkOnInline)
          ) {
            const referenceId = this.emitFile({
              type: 'chunk',
              id: cleanUrl(file),
            })
            s.update(
              expStart,
              expEnd,
              "__VITE_WORKER_CHUNK__" + referenceId + "__",
            )
          } else {`

const imuReplace = `          } else if (
            isBundled &&
            this.environment.config.command === 'build' &&
            workerType === 'module' &&
            config.worker.format === 'es' &&
            config.worker.shareChunks &&
            (!/[?&]inline\\b/.test(file) || config.worker.shareChunkOnInline)
          ) {
            const referenceId = this.emitFile({
              type: 'chunk',
              id: cleanUrl(file),
            })
            s.update(
              expStart,
              expEnd,
              "import.meta.ROLLUP_FILE_URL_" + referenceId,
            )
          } else {`

imuContent = imuContent.replace(imuSearch, imuReplace)
// Also handle partial change
imuContent = imuContent.replace('"__VITE_WORKER_CHUNK__" + referenceId + "__"', '"import.meta.ROLLUP_FILE_URL_" + referenceId')

fs.writeFileSync('packages/vite/src/node/plugins/workerImportMetaUrl.ts', imuContent)
