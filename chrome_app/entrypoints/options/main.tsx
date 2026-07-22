import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { OptionsApp } from './options-app';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
