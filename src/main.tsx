import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Глобальный перехватчик ошибок для диагностики "Archive is not defined"
window.onerror = function(message, source, lineno, colno, error) {
  const errorMsg = `
    🚨 КРИТИЧЕСКАЯ ОШИБКА: ${message}
    Где: ${source}
    Строка: ${lineno}:${colno}
    Файл сборки: ${source ? source.split('/').pop() : 'unknown'}
  `;
  console.error(errorMsg, error);
  // Используем тайм-аут, чтобы alert не блокировал отрисовку логов
  setTimeout(() => alert(errorMsg), 100);
  return false;
};

console.log('%c [SYSTEM] v1.0.6 - INTEGRATIONS_DEBUG_MODE', 'color: #00ff00; font-weight: bold; font-size: 16px;');
console.log('[DEBUG] Last build date:', new Date().toLocaleString());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
