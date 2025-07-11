const { Pool } = require('pg');
require('dotenv').config();

// สร้าง Pool การเชื่อมต่อสำหรับ PostgreSQL
const pool = new Pool({
  connectionString: process.env.DB_INTERNAL_URL, 
  ssl: {
    rejectUnauthorized: false
  }
});

// ส่งออก (export) object ที่มีเมธอดที่จำเป็น
// เพื่อให้ server.js เดิมของคุณยังทำงานได้เหมือนเดิม
module.exports = {
    query: (text, params) => pool.query(text, params),
    getConnection: () => pool.connect()
};