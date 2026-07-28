import { sharedFn } from './shared-dep'
self.onmessage = () => {
  sharedFn()
}
