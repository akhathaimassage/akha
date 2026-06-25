require('dotenv').config();
const { Pool } = require('pg');
const pg = require('pg');

// Force pg to return TIMESTAMP (timestamp without time zone) as string to prevent timezone shifts
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val) => val);

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

// ถ้าเป็น Production (บน Render) หรือใช้ DB Host ของ Render ให้เปิดใช้ SSL
const isRender = process.env.DB_HOST && process.env.DB_HOST.includes('render.com');
if (isProduction || isRender) {
  connectionConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(connectionConfig);

// Export object ที่มี query method เพื่อให้ server.js ใช้งานได้เหมือนเดิม
module.exports = {
    query: (text, params) => pool.query(text, params)
};