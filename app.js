import express from 'express';
import cors from 'cors';
import referenceRoutes from './routes/referenceRoutes.js';
import connectDB from './db.js';

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

//미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//라우터 설정 (레퍼런스만 추가되어있음)
app.use('/api', referenceRoutes);

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));