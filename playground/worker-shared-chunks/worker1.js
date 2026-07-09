import { data } from './shared.js'
self.onmessage = () => {
  self.postMessage('worker1:' + data)
}
