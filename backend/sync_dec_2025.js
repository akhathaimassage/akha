require('dotenv').config();
const { Client, types } = require('pg');
const fs = require('fs');

// Force node-postgres to parse 'timestamp without time zone' (OID 1114) as UTC
// This prevents timezone shifting when running the script from different locations (local vs server).
types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue + '+00:00');
});

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_DATABASE}`;

// Configuration maps
const therapistMap = {
  'angie': 8,
  'paeng': 5,
  'pheng': 5,
  'daeng': 5,
  'ane': 1,
  'kathin': 4,
  'ไม่ระบุชื่อ': 3, // Default to Beistand
  'guest': 3
};

function mapTherapistId(name) {
  if (!name) return 3;
  const n = name.trim().toLowerCase();
  return therapistMap[n] || 3;
}

// Maps price to duration and service ID
function getServiceDetails(duration, price, customerName) {
  let finalDuration = duration;
  let finalPrice = price;
  let serviceId = 3; // Default to Klassische Thai-Massage 60 Min

  // Determine duration from price if unspecified
  if (finalDuration === null) {
    if (finalPrice === 40) finalDuration = 40;
    else if (finalPrice === 50 || finalPrice === 52) finalDuration = 60;
    else if (finalPrice === 75 || finalPrice === 78) finalDuration = 90;
    else if (finalPrice === 95) finalDuration = 120;
    else if (finalPrice === 80 && customerName && customerName.includes('Marinela')) finalDuration = 40; // 40€ x 2
    else finalDuration = 60; // Default
  }

  // Determine price from duration if unspecified
  if (finalPrice === null) {
    if (finalDuration === 40) finalPrice = 40;
    else if (finalDuration === 60) finalPrice = 52;
    else if (finalDuration === 90) finalPrice = 75;
    else if (finalDuration === 120) finalPrice = 95;
    else finalPrice = 52; // Default
  }

  // Match service_id
  if (finalDuration === 40) {
    serviceId = 2; // Klassische Thai-Massage 40 Min
  } else if (finalDuration === 60) {
    serviceId = 3; // Klassische Thai-Massage 60 Min
    if (customerName && (customerName.toLowerCase().includes('gutschein') || customerName.includes('Caman'))) {
      serviceId = 15; // Aroma-Öl 60 Min
    }
  } else if (finalDuration === 90) {
    serviceId = 4; // Klassische Thai-Massage 90 Min
    if (customerName && (customerName.toLowerCase().includes('gutschein') || customerName.includes('michele') || customerName.includes('patricia'))) {
      serviceId = 16; // Aroma-Öl 90 Min
    }
  } else if (finalDuration === 120) {
    serviceId = 5; // Klassische Thai-Massage 120 Min
    if (customerName && (customerName.toLowerCase().includes('sandra') || customerName.includes('bastian') || customerName.includes('nicole') || customerName.includes('reinhard') || customerName.includes('walk in'))) {
      serviceId = 17; // Aroma-Öl 120 Min
    }
  } else if (finalDuration === 100) {
    // Custom case for Brono (22) | 100 Min | 95 €
    serviceId = 9; // Thai-Sportmassage 120 Min
    finalDuration = 100;
  }

  return { duration: finalDuration, price: finalPrice, serviceId };
}

// Clean helper
function clean(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function getOrCreateCustomer(client, name) {
  const cleanName = name.trim();
  const searchRes = await client.query('SELECT id FROM customers WHERE full_name = $1 LIMIT 1', [cleanName]);
  if (searchRes.rows.length > 0) {
    return searchRes.rows[0].id;
  }
  const insertRes = await client.query(
    'INSERT INTO customers (full_name, phone_number) VALUES ($1, $2) RETURNING id',
    [cleanName, 'N/A']
  );
  return insertRes.rows[0].id;
}

async function main() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Render Database successfully!');

    // Read and parse user list
    const userText = fs.readFileSync('C:/Users/Jack-PC/.gemini/antigravity-ide/brain/8f6cbdfa-e5f6-495b-b4b2-2288299a3a4b/scratch/user_bookings_dec_2025.txt', 'utf8');
    const lines = userText.split('\n');
    const userBookingsByDate = {};
    let currentDate = null;
    let currentTherapist = null;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (/^\d{2}\.\d{2}\.\d{4}$/.test(line)) {
        currentDate = line;
        userBookingsByDate[currentDate] = [];
        currentTherapist = null;
        continue;
      }

      if (line.startsWith('พนักงาน:')) {
        currentTherapist = line.replace('พนักงาน:', '').trim();
        continue;
      }

      if (line.startsWith('ลูกค้า:')) {
        const parts = line.replace('ลูกค้า:', '').split('|').map(p => p.trim());
        const customerName = parts[0] || 'ไม่ระบุชื่อ';
        
        let duration = null;
        if (parts[1] && parts[1].includes('Min')) {
          duration = parseInt(parts[1]);
        }

        let price = null;
        if (parts[2] && parts[2].includes('€')) {
          price = parseFloat(parts[2].replace('€', '').trim());
        }

        const dateParts = currentDate.split('.');
        const dbDateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; // YYYY-MM-DD

        userBookingsByDate[currentDate].push({
          date: currentDate,
          dbDateStr: dbDateStr,
          therapist: currentTherapist,
          customer: customerName,
          duration: duration,
          price: price,
          originalLine: line
        });
      }
    }

    // Begin Transaction
    await client.query('BEGIN');
    console.log('--- Transaction Started ---');

    // 1. Delete the specific extra bookings
    const extrasToDelete = [1355, 1347, 1104];
    console.log(`Deleting extra bookings: ${extrasToDelete.join(', ')}`);
    await client.query('DELETE FROM bookings WHERE id = ANY($1)', [extrasToDelete]);

    // 2. Loop through each date
    const allDates = Object.keys(userBookingsByDate).sort((a,b) => {
      return parseInt(a.split('.')[0]) - parseInt(b.split('.')[0]);
    });

    for (const date of allDates) {
      console.log(`\nProcessing Date: ${date}`);
      
      const ubs = userBookingsByDate[date];
      
      // Query existing bookings on this date (convert UTC start_datetime to date in UTC)
      const dateParts = date.split('.');
      const queryDateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      const dbRes = await client.query(`
        SELECT b.id, b.start_datetime, b.end_datetime, b.price_at_booking,
               c.full_name as customer_name, t.full_name as therapist_name, t.id as therapist_id
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN therapists t ON b.therapist_id = t.id
        WHERE b.start_datetime::date = $1
        ORDER BY b.start_datetime ASC, b.id ASC
      `, [queryDateStr]);

      let dbs = dbRes.rows;
      console.log(`Database had ${dbs.length} bookings initially on this date.`);

      // We will perform greedy matching:
      // For each user list booking, find the best matching database booking
      const matchedDbIds = new Set();
      const updates = [];
      const inserts = [];

      // Keep track of times used to avoid overlaps for new/unspecified entries
      const usedTimes = dbs.map(db => {
        const start = new Date(db.start_datetime);
        return start.getUTCHours() * 60 + start.getUTCMinutes();
      });

      for (const ub of ubs) {
        let bestMatch = null;
        let highestScore = -1;

        dbs.forEach(db => {
          if (matchedDbIds.has(db.id)) return;

          let score = 0;
          const mappedTherapistId = mapTherapistId(ub.therapist);

          // Therapist match
          if (db.therapist_id === mappedTherapistId) {
            score += 5;
          } else if (mappedTherapistId === 3 && (db.therapist_id === 3 || db.therapist_id === 6)) {
            score += 4;
          }

          // Price match
          if (ub.price !== null && parseFloat(db.price_at_booking) === ub.price) {
            score += 4;
          }

          // Customer name match
          if (clean(db.customer_name) === clean(ub.customer)) {
            score += 8;
          } else if (clean(db.customer_name).includes(clean(ub.customer)) || clean(ub.customer).includes(clean(db.customer_name))) {
            score += 4;
          }

          if (score > highestScore) {
            highestScore = score;
            bestMatch = db;
          }
        });

        if (bestMatch && highestScore >= 4) {
          matchedDbIds.add(bestMatch.id);
          updates.push({ ub, db: bestMatch });
        } else {
          inserts.push(ub);
        }
      }

      // Execute Updates
      for (const { ub, db } of updates) {
        const therapistId = mapTherapistId(ub.therapist);
        const customerId = await getOrCreateCustomer(client, ub.customer);
        const { duration, price, serviceId } = getServiceDetails(ub.duration, ub.price, ub.customer);

        // Keep the original start time from the database (now correctly parsed in UTC)
        const start = new Date(db.start_datetime);
        const end = new Date(start.getTime() + duration * 60000);

        const startStr = start.toISOString().replace('T', ' ').substring(0, 19);
        const endStr = end.toISOString().replace('T', ' ').substring(0, 19);

        console.log(`  Updating Booking ID ${db.id}: "${db.customer_name}" -> "${ub.customer}" | Therapist: ${db.therapist_name} -> ID ${therapistId} | Service ID: ${serviceId} | Price: ${price} €`);
        await client.query(`
          UPDATE bookings 
          SET customer_id = $1, therapist_id = $2, service_id = $3, 
              start_datetime = $4, end_datetime = $5, price_at_booking = $6,
              status = 'confirmed'
          WHERE id = $7
        `, [customerId, therapistId, serviceId, startStr, endStr, price, db.id]);
      }

      // Execute Inserts
      // Determine consecutive slots starting from 09:00 (which corresponds to 09:00 in UTC representation in the DB)
      let currentHour = 9;
      let currentMin = 0;

      for (const ub of inserts) {
        const therapistId = mapTherapistId(ub.therapist);
        const customerId = await getOrCreateCustomer(client, ub.customer);
        const { duration, price, serviceId } = getServiceDetails(ub.duration, ub.price, ub.customer);

        let startMinutes = currentHour * 60 + currentMin;
        while (usedTimes.includes(startMinutes)) {
          startMinutes += 90; // Add 1.5 hours
        }
        usedTimes.push(startMinutes);

        const slotHour = Math.floor(startMinutes / 60);
        const slotMin = startMinutes % 60;
        
        const startStr = `${ub.dbDateStr} ${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}:00`;
        
        // End time is start time + duration
        const startDate = new Date(`${ub.dbDateStr}T${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}:00Z`);
        const endDate = new Date(startDate.getTime() + duration * 60000);
        const endStr = endDate.toISOString().replace('T', ' ').substring(0, 19);

        console.log(`  Inserting New Booking: "${ub.customer}" | Therapist ID: ${therapistId} | Service ID: ${serviceId} | Time: ${startStr} (${duration} Min) | Price: ${price} €`);
        await client.query(`
          INSERT INTO bookings (customer_id, therapist_id, service_id, start_datetime, end_datetime, status, price_at_booking)
          VALUES ($1, $2, $3, $4, $5, 'confirmed', $6)
        `, [customerId, therapistId, serviceId, startStr, endStr, price]);

        // Increment default slot for the next insert on this day
        currentMin += duration;
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;
        }
      }

      // Delete any database bookings on this date that did not match any user record
      for (const db of dbs) {
        if (!matchedDbIds.has(db.id)) {
          console.log(`  Deleting extra unmatched database booking ID ${db.id} on ${date}: "${db.customer_name}" / ${db.therapist_name}`);
          await client.query('DELETE FROM bookings WHERE id = $1', [db.id]);
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n--- Transaction Committed Successfully! ---');

  } catch (err) {
    console.error('Error during synchronization:', err);
    await client.query('ROLLBACK');
    console.log('--- Transaction Rolled Back ---');
  } finally {
    await client.end();
  }
}

main();
