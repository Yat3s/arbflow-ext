import React from 'react'
import ReactDOM from 'react-dom/client'
import '../index.css'
import MainOptions from './MainOptions'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <MainOptions />
  </React.StrictMode>,
)
