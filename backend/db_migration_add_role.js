require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
};

async function main() {
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('Successfully connected to Render Postgres.');

    await client.query('BEGIN');

    // 1. Add role column to admin_users table if it doesn't exist
    console.log('Adding role column to admin_users table...');
    await client.query(`
      ALTER TABLE admin_users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';
    `);

    // 2. Insert a staff user: staff / akha2026
    const staffUsername = 'staff';
    const staffPassword = 'akha2026';

    const checkRes = await client.query('SELECT id FROM admin_users WHERE username = $1', [staffUsername]);
    
    // Cleanup: Delete the old 'receptionist' username if it exists
    await client.query("DELETE FROM admin_users WHERE username = 'receptionist'");

    if (checkRes.rows.length === 0) {
      console.log(`Creating staff account: ${staffUsername}...`);
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(staffPassword, saltRounds);
      
      await client.query(`
        INSERT INTO admin_users (username, password_hash, role) 
        VALUES ($1, $2, 'staff')
      `, [staffUsername, passwordHash]);
      
      console.log(`Staff account created successfully! Password: ${staffPassword}`);
    } else {
      console.log(`Staff account '${staffUsername}' already exists. Updating role to 'staff'...`);
      await client.query(`
        UPDATE admin_users SET role = 'staff' WHERE username = $1
      `, [staffUsername]);
    }

    await client.query('COMMIT');
    console.log('Database migration completed successfully!');

  } catch (err) {
    console.error('Error during migration:', err);
    if (client) {
      await client.query('ROLLBACK');
    }
  } finally {
    await client.end();
  }
}

main();
