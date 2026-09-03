import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/shell.css'
import './app/auth-brands.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
