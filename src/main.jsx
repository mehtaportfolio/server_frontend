import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

let registration;

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
    // This will only be called if registerType is 'prompt' in vite.config.js
    // But keeping it as fallback
    if (confirm('New content available. Reload?')) {
      window.location.reload();
    }
  }
})

// Check for updates when the app becomes visible (e.g., when opening on mobile)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && registration) {
    registration.update();
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
