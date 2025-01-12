import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import referenceRoutes from './routes/referenceRoutes.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL).then(() => console.log('Connected to DB'));

//라우터 설정 (레퍼런스만 추가되어있음)
app.use('/', referenceRoutes);

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));