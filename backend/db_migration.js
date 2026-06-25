require('dotenv').config();
const { Client } = require('pg');

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false } // Render requires SSL
};

async function main() {
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('Successfully connected to Render Postgres.');

    await client.query('BEGIN');

    // 1. Add require_timesheet column to therapists table if it doesn't exist
    console.log('Adding require_timesheet column to therapists table...');
    await client.query(`
      ALTER TABLE therapists 
      ADD COLUMN IF NOT EXISTS require_timesheet BOOLEAN DEFAULT false;
    `);

    // 2. Create therapist_timesheets table
    console.log('Creating therapist_timesheets table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_timesheets (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        break_minutes INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(therapist_id, work_date)
      );
    `);

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
