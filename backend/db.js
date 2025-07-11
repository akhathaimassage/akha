const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // ใช้วิธีนี้จะง่ายที่สุด โดยการนำ Internal Connection URL ทั้งหมดจาก Render มาใส่
  connectionString: process.env.DB_INTERNAL_URL, 
  // บรรทัดด้านล่างนี้สำคัญมาก สำหรับการเชื่อมต่อกับฐานข้อมูลบนคลาวด์
  ssl: {
    rejectUnauthorized: false
  }
});
// ตรวจสอบการเชื่อมต่อครั้งแรก
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully!');
        connection.release();
    })
    .catch(error => {
        console.error('❌ Database connection failed:', error.message);
    });

module.exports = pool;