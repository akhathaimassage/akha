require('dotenv').config(); // โหลดค่าจากไฟล์ .env
const { Pool } = require('pg');

// ตรวจสอบว่าเรากำลังทำงานบน Render หรือในเครื่อง
const isProduction = process.env.NODE_ENV === 'production';

const connectionConfig = isProduction 
    ? { // ใช้ Internal URL ของ Render เมื่ออยู่บน Production
        connectionString: process.env.DB_INTERNAL_URL,
        ssl: {
            rejectUnauthorized: false
        }
      }
    : { // ใช้ค่าจาก .env เมื่อทำงานในเครื่อง (Local)
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: process.env.DB_PORT,
      };

const db = new Pool(connectionConfig);

module.exports = db;