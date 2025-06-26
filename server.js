require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const patientRecordRoutes = require('./routes/patientRecordRoutes');

const app = express();
app.use(express.json());
connectDB();

app.get('/', (req, res) => {
  res.send('Electronic Health Record System');
});

app.use('/api/users', userRoutes);
app.use('/api/patient-records', patientRecordRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
