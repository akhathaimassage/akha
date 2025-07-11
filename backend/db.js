const { Pool } = require('pg');
require('dotenv').config();

// สร้าง Pool โดยใช้ Environment Variables แยกส่วน
// เพื่อให้แน่ใจว่า SSL ถูกบังคับใช้อย่างชัดเจน
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  
  // ★★★ การตั้งค่า SSL ยังคงเป็นส่วนที่สำคัญที่สุด ★★★
  ssl: {
    rejectUnauthorized: false
  }
});

// ส่งออก (export) object เพื่อให้ server.js เดิมทำงานได้
module.exports = {
    query: (text, params) => pool.query(text, params),
    getConnection: () => pool.connect()
};