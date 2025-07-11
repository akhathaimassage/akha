const mysql = require('mysql2/promise');
require('dotenv').config();

// สร้าง Connection Pool เพื่อการเชื่อมต่อที่มีประสิทธิภาพ
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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