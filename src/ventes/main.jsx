// Dashboard des ventes de merch : obsimo.com/ventes/ (mot de passe, voir api/ventes.js).
// React + shadcn/ui. Pages dans pages/, fenêtres dans components/dialogs/.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// polices servies avec le site (pas de CDN)
import '@fontsource-variable/inter'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'
import { App } from './app'

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
