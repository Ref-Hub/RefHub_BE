// User provider 필드 업데이트 스크립트

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const mongoURI = process.env.MONGO_URI_DEV;

const run = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB가 연결되었습니다.');

    const result = await User.updateMany(
      { provider: { $exists: false } },
      { $set: { provider: 'local' } }
    );

    console.log(`provider 업데이트 완료: ${result.modifiedCount}개 문서`);
    process.exit(0);
  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  }
};

run();