import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/500.css';
import '@fontsource/noto-sans-thai-looped/400.css';
import '@fontsource/noto-sans-thai-looped/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { App } from './App';
import { installFlushHandlers } from './store/persistence';
import { startSync } from './sync/syncStore';

installFlushHandlers();
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
