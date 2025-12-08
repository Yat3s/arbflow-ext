import React from 'react'
import ReactDOM from 'react-dom/client'
import '../index.css'
import { DevTools } from './DevTools'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <DevTools />
  </React.StrictMode>,
)

chrome.devtools.panels.create('ReactCrx', '', '../../devtools.html', function () {
  console.log('devtools panel create')
})
