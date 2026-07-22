import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { PopupApp } from './popup-app';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
