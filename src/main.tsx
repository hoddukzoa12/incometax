import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { APP_MESSAGES } from './messages/app'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'

const ROOT_ELEMENT_ID = 'root'
const rootElement = document.getElementById(ROOT_ELEMENT_ID)
document.title = APP_MESSAGES.title

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
