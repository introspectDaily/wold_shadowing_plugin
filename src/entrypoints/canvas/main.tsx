import React from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasApp } from '../../components/canvas/CanvasApp';
import '../styles/global.css';
import '../styles/canvas.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CanvasApp />
  </React.StrictMode>,
);
