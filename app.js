import express from 'express';
import cors from 'cors';
import connectDB from './db.js';

import userRoutes from './routes/userRoutes.js';
import collectionRoutes from './routes/collectionRoutes.js';
import referenceRoutes from './routes/referenceRoutes.js';

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB 연결
connectDB();

// 라우트 설정
app.use('/api/users', userRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api', referenceRoutes);

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));