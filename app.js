import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';

//import referenceRoutes from './routes/referenceRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL).then(() => console.log('Connected to DB'));

//app.use('/', referenceRoutes);
app.use('/api/users', userRoutes);

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));