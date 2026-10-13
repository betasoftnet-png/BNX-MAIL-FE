import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './utils/quillPatch';

// Automatically reload if Vite dynamic chunk fails to load due to a new deployment
window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Preload error detected. Reloading page...', event);
    window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);