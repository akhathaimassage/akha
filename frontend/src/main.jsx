import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
// ไม่ต้อง import BrowserRouter ที่นี่แล้ว

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* เรียกใช้ App ตรงๆ ได้เลย เพราะ BrowserRouter อยู่ใน App.jsx แล้ว */}
    <App />
  </React.StrictMode>,
);