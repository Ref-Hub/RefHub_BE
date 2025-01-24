import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURL = process.env.MONGO_URL;


// db 연결
const connectDB = async () => {
    try {
      await mongoose.connect(mongoURL);
      console.log('MongoDB가 연결되었습니다.');

      
    } catch (err) {
      console.error('MongoDB가 연결되지 않았습니다.', err);
      process.exit(1); // 연결 실패 시 프로그램 종료
    }
  };
  
  export default connectDB;