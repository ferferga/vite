import { msg } from './shared.js'
self.onmessage = () => self.postMessage('worker1:' + msg)
