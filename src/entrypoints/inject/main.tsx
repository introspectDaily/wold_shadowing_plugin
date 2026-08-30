import React from 'react';
import { createRoot } from 'react-dom/client';
import { ShadowingWidget } from '../../components/ShadowingWidget';
import '../styles/global.css';
import '../styles/inject.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ShadowingWidget />
  </React.StrictMode>,
);
