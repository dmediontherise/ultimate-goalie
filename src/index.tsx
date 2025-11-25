import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Global error handler for uncaught exceptions
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global Error (onerror):', { message, source, lineno, colno, error });
  // Prevent default browser error handling
  return true;
};

// Global error handler for unhandled promise rejections
window.onunhandledrejection = (event) => {
  console.error('Global Error (onunhandledrejection):', event.reason);
  // Prevent default browser error handling
  event.preventDefault();
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);