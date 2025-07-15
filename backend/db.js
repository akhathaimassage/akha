const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // ใช้วิธีนี้จะง่ายที่สุด โดยการนำ Internal Connection URL ทั้งหมดจาก Render มาใส่
  connectionString: process.env.DB_INTERNAL_URL, 
  
  // ★★★ บรรทัดนี้สำคัญที่สุดสำหรับแก้ปัญหา SSL ★★★
  ssl: {
    rejectUnauthorized: false
  }
});

// ส่งออก (export) object เพื่อให้ server.js เดิมทำงานได้
module.exports = {
    query: (text, params) => pool.query(text, params),
    getConnection: () => pool.connect()
};