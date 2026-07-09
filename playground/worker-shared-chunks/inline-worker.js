import { data } from './shared.js'
self.onmessage = () => {
  self.postMessage('inline-worker:' + data)
}
