import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { SessionProvider } from './context/Session.jsx';
import { UIProvider } from './context/UI.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SessionProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </SessionProvider>
  </StrictMode>,
);
