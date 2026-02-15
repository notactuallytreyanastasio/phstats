import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './shell/components/App.tsx'
import PhanGraphsPage from './shell/components/phangraphs/PhanGraphsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/phangraphs" element={<PhanGraphsPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
