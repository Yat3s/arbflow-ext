import React from 'react'
import ReactDOM from 'react-dom/client'
import '../index.css'
import { SidePanel } from './SidePanel'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
)
