import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const ROOT_ELEMENT_ID = 'root'
const rootElement = document.getElementById(ROOT_ELEMENT_ID)

if (rootElement) {
  createRoot(rootElement).render(<StrictMode />)
}

