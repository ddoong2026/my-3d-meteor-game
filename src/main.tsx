import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import AdminOverlay from './components/AdminOverlay'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminOverlay>
      <App />
    </AdminOverlay>
  </StrictMode>,
)
