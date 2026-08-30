import React from 'react';
import { createRoot } from 'react-dom/client';
import { StandaloneApp } from '../../components/StandaloneApp';
import '../styles/global.css';
import '../styles/standalone.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>,
);
