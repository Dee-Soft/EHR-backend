require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// cron jobs auto loader
const startAllCrons = require('./crons');

const cookieParser = require('cookie-parser');


//routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const patientRecordRoutes = require('./routes/patientRecordRoutes');
const adminRoutes = require('./routes/adminRoutes');

const keyExchangeRoutes = require('./routes/keyExchangeRoutes');


const app = express();

// middleware
app.use(helmet());
app.use(cookieParser());
app.use(cors());
app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
app.use(express.json());

connectDB();

// api endpoints
app.get('/', (req, res) => {
  res.send('Electronic Health Record System backend is running securely!');
});
app.use('/api/users', userRoutes);
app.use('/api/patient-records', patientRecordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/key-exchange', keyExchangeRoutes);

// start server
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
