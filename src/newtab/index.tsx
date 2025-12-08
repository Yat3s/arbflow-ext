import React from 'react'
import ReactDOM from 'react-dom/client'
import '../index.css'
import { NewTab } from './NewTab'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <NewTab />
  </React.StrictMode>,
)
