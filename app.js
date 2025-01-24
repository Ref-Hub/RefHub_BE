import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import referenceRoutes from './routes/referenceRoutes.js';
import collectionRoutes from './routes/collectionRoutes.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log("MongoDB 연결 성공!");
  }).catch((err) => {
    console.error("MongoDB 연결 실패:", err.message);
  });


//미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//라우터 설정 (레퍼런스만 추가되어있음)
app.use('/api', referenceRoutes);

app.listen(process.env.PORT || 3000, () => console.log('Server Started'));