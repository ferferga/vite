import { data } from './shared.js'
import Worker1 from './worker1.js?worker'
import Worker2 from './worker2.js?worker'
import InlineWorker from './inline-worker.js?worker&inline'

console.log('App starting with ?worker imports')

const worker1 = new Worker1()
const worker2 = new Worker2()
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
