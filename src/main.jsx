/**
 * Point d'entrée de l'application React.
 * Monte le composant App dans l'élément #root défini dans index.html.
 * StrictMode active des vérifications supplémentaires en développement.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
