import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/ui/toast';

// L'ordine conta: index.css definisce i token del tema, i due file successivi
// costruiscono sopra quei token e devono poterne vincere le regole.
import './index.css';
import './styles/components.css';
import './styles/landing.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
