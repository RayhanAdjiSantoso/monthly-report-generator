import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/shell.css'
import './app/auth-brands.css'
import App from './App.tsx'

// Every deploy re-hashes the chunk filenames. A tab that was opened before the
// deploy then 404s the moment it lazy-loads a vendor chunk (html2canvas / jspdf
// / xlsx for the export buttons), surfacing as "Failed to fetch dynamically
// imported module". Reload once to pick up the current index.html + chunk map;
// the sessionStorage guard stops it looping if the failure is real.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('chunk-reload') === '1') return
  sessionStorage.setItem('chunk-reload', '1')
  window.location.reload()
})
// Reaching a clean render means the current chunks loaded — arm the guard again
// so the next deploy also gets its one free reload.
sessionStorage.removeItem('chunk-reload')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
