import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/index.css'
import { App } from './ui/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Once the app is up, and out of its way: recordings no session points to.
window.setTimeout(() => {
  void import('./record/videoStore.ts')
    .then((store) => store.pruneOrphanRecordings())
    .catch(() => {})
}, 3000)
