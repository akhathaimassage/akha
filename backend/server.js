const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ★★★ DEBUGGING CODE ★★★
console.log("--- Verifying Environment Variables ---");
console.log("Value for DB_DATABASE:", process.env.DB_DATABASE);
console.log("Value for DATABASE_URL:", process.env.DATABASE_URL);
console.log("------------------------------------");
// ★★★ END DEBUGGING CODE ★★★

const port = process.env.PORT || 3001;

// --- Middlewares ---
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://akhathaimassage.de',
    'https://www.akhathaimassage.de',
    'https://akha.onrender.com'
  ]
}));
app.use(express.json());

// --- Routers ---
const authRouter = require('./routes/auth');
const therapistsRouter = require('./routes/therapists');
const servicesRouter = require('./routes/services');
const bookingsRouter = require('./routes/bookings');
const timesheetsRouter = require('./routes/timesheets');
const usersRouter = require('./routes/users');

app.use(authRouter);
app.use(therapistsRouter);
app.use(servicesRouter);
app.use(bookingsRouter);
app.use(timesheetsRouter);
app.use(usersRouter);

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});