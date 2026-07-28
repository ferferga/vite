import MyWorker from './worker?worker'
import { sharedFn } from './shared-dep'

console.log(MyWorker, sharedFn)
