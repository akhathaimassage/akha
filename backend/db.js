require('dotenv').config();
const { Pool } = require('pg');

// ตรวจสอบว่านี่เป็น Production Environment หรือไม่ (เช่น บน Render.com)
const isProduction = process.env.NODE_ENV === 'production';

// เตรียม object สำหรับการตั้งค่า
const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE, // <-- ใช้ DB_DATABASE จากไฟล์ .env
  port: process.env.DB_PORT || 5432,
};

// ถ้าเป็น Production (บน Render) ให้เปิดใช้ SSL
// ถ้าเป็น Development (บนเครื่องเรา) จะไม่มี property นี้ และ node-postgres จะไม่ใช้ SSL โดยอัตโนมัติ
if (isProduction) {
  connectionConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(connectionConfig);

// Export object ที่มี query method เพื่อให้ server.js ใช้งานได้เหมือนเดิม
module.exports = {
    query: (text, params) => pool.query(text, params)
};