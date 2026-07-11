import { data } from './shared.js'
import Worker1 from './worker1.js?worker'
import Worker2 from './worker2.js?worker'

document.querySelector('.main-res').textContent = 'main:' + data

const worker1 = new Worker1()
worker1.onmessage = (e) => {
  document.querySelector('.worker1-res').textContent = e.data
}
worker1.postMessage('go')

const worker2 = new Worker2()
worker2.onmessage = (e) => {
  document.querySelector('.worker2-res').textContent = e.data
}
worker2.postMessage('go')
