import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { FamilyHubApp } from './family-hub-app';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FamilyHubApp />
  </React.StrictMode>
);
