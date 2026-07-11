import fs from 'node:fs'

function patchFile(filePath, search, replace) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const newContent = content.replace(search, replace)
  if (content === newContent && !content.includes(replace)) {
    console.error(`Failed to patch ${filePath}: search string not found`)
    process.exit(1)
  }
  fs.writeFileSync(filePath, newContent)
  console.log(`Patched ${filePath}`)
}

// Restore original packages/vite/src/node/plugins/worker.ts first to undo my renderChunk mess
// Actually I'll just overwrite it.

// Reset files to a clean state first (from git)
// (Wait, I should be careful not to lose the config changes)
