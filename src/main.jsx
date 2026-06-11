import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.onerror = function(msg, src, line, col, err) {
  document.getElementById('root').innerHTML = '<div style="color:white;padding:20px;font-family:sans-serif"><h2>Error</h2><p>' + msg + '</p><p>' + src + ':' + line + '</p></div>';
  return false;
}

window.onunhandledrejection = function(e) {
  document.getElementById('root').innerHTML = '<div style="color:white;padding:20px;font-family:sans-serif"><h2>Promise Error</h2><p>' + e.reason + '</p></div>';
}

try {
  const root = document.getElementById('root')
  if (root) {
    createRoot(root).render(<StrictMode><App /></StrictMode>)
  }
} catch(e) {
  document.getElementById('root').innerHTML = '<div style="color:white;padding:20px;font-family:sans-serif"><h2>Catch Error</h2><p>' + e.message + '</p><p>' + e.stack + '</p></div>'
}
