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

// hors réseau : l'appli s'ouvre quand même ; et les notifications de vente (voir public/ventes/sw.js)
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/ventes/sw.js', { scope: '/ventes/' }).catch(() => {}))
}
