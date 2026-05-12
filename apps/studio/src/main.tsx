import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'

const router = getRouter()
const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('Studio root element "#app" was not found.')
}

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser')
    const baseUrl = import.meta.env.BASE_URL || '/'
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    await worker.start({
      serviceWorker: { url: `${normalizedBase}mockServiceWorker.js` },
      onUnhandledRequest: 'bypass',
    })
  }

  ReactDOM.createRoot(rootElement!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  )
}

void bootstrap()
