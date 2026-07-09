import { data } from './shared.js'
self.onmessage = () => {
  self.postMessage('worker2:' + data)
}
