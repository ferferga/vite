import fs from 'node:fs'
let content = fs.readFileSync('packages/vite/src/node/plugins/worker.ts', 'utf-8')

// Remove workerChunkUrlRE
content = content.replace('\nexport const workerChunkUrlRE: RegExp = /__VITE_WORKER_CHUNK__([\\w$!~%\\\\{\\\\}\\\\d]+)__/g', '')

// Fix load hook to use import.meta.ROLLUP_FILE_URL_ directly
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
          urlCode = "__VITE_WORKER_CHUNK__" + referenceId + "__"
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
content = content.replace(loadSearch, loadReplace)

// Restore original renderChunk (remove my additions)
// I'll just use a simpler replacement to revert it
const myRenderChunk = `          renderChunk(code, chunk, outputOptions) {
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

            const toRelativeRuntime = createToImportMetaURLBasedRelativeRuntime(
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
                  toRelativeRuntime,
                )

                let replacementString
                if (typeof replacement === 'string') {
                  const resolvedUrl = encodeURIPath(replacement)
                  replacementString = \`new URL("\${resolvedUrl}", import.meta.url).href\`
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

content = content.replace(myRenderChunk, originalRenderChunk)
fs.writeFileSync('packages/vite/src/node/plugins/worker.ts', content)

// Now fix workerImportMetaUrl.ts
let imuContent = fs.readFileSync('packages/vite/src/node/plugins/workerImportMetaUrl.ts', 'utf-8')
const imuSearch = `            const referenceId = this.emitFile({
              type: 'chunk',
              id: cleanUrl(file),
            })
            s.update(
              expStart,
              expEnd,
              "__VITE_WORKER_CHUNK__" + referenceId + "__",
            )`
const imuReplace = `            const referenceId = this.emitFile({
              type: 'chunk',
              id: cleanUrl(file),
            })
            s.update(
              expStart,
              expEnd,
              "import.meta.ROLLUP_FILE_URL_" + referenceId,
            )`
imuContent = imuContent.replace(imuSearch, imuReplace)
fs.writeFileSync('packages/vite/src/node/plugins/workerImportMetaUrl.ts', imuContent)
