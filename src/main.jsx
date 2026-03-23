import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

let registration;

try {
  registerSW({
    immediate: true,
    onRegistered(r) {
      registration = r;
      if (r) {
        // Check for updates every hour
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onNeedRefresh() {
      if (confirm('New content available. Reload?')) {
        window.location.reload();
      }
    }
  })
} catch (e) {
  console.error('PWA registration failed:', e)
}

// Check for updates when the app becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && registration) {
    registration.update();
  }
})

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  console.error('Root element not found');
}
