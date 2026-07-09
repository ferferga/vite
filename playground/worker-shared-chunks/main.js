import { data } from './shared.js'
import InlineWorker from './inline-worker.js?worker&inline'

const worker1 = new Worker(new URL('./worker1.js', import.meta.url), { type: 'module' })
const worker2 = new Worker(new URL('./worker2.js', import.meta.url), { type: 'module' })
const inlineWorker = new InlineWorker()

document.querySelector('.main-res').textContent = 'main:' + data

worker1.onmessage = (e) => {
  document.querySelector('.worker1-res').textContent = e.data
}
worker1.postMessage('ping')

worker2.onmessage = (e) => {
  document.querySelector('.worker2-res').textContent = e.data
}
worker2.postMessage('ping')

inlineWorker.onmessage = (e) => {
  document.querySelector('.inline-worker-res').textContent = e.data
}
inlineWorker.postMessage('ping')
