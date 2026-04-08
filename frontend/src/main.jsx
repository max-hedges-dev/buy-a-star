import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import aaSymbolBlack from './assets/AA Symbol Black.png'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const ensureHeadLink = (selector, rel) => {
  const existing = document.querySelector(selector)
  if (existing) return existing

  const link = document.createElement('link')
  link.rel = rel
  document.head.appendChild(link)
  return link
}

const faviconLink = ensureHeadLink("link[rel='icon']", 'icon')
const appleTouchIconLink = ensureHeadLink("link[rel='apple-touch-icon']", 'apple-touch-icon')

const iconImage = new Image()
iconImage.onload = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256

  const context = canvas.getContext('2d')
  if (!context) return

  // Crop tightly around the centered symbol so it reads larger in the tab.
  const cropSize = Math.min(iconImage.naturalWidth, iconImage.naturalHeight) * 0.54
  const sx = (iconImage.naturalWidth - cropSize) / 2
  const sy = (iconImage.naturalHeight - cropSize) / 2

  context.drawImage(iconImage, sx, sy, cropSize, cropSize, 0, 0, canvas.width, canvas.height)

  const dataUrl = canvas.toDataURL('image/png')
  faviconLink.type = 'image/png'
  faviconLink.href = dataUrl
  appleTouchIconLink.href = dataUrl
}
iconImage.src = aaSymbolBlack

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
