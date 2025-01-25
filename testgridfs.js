import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

const testGridFSConnection = async () => {
  try {
    // MongoDB 연결
    const connection = await mongoose.connect(process.env.DATABASE_URL);
    console.log("MongoDB 연결 성공!");

    // GridFSBucket 생성
    const db = connection.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });

    // GridFS 상태 확인
    console.log("GridFSBucket 연결 성공!");
    console.log("버킷 이름:", bucket.s.options.bucketName);
  } catch (error) {
    console.error("GridFSBucket 연결 실패:", error.message);
  } finally {
    mongoose.disconnect();
  }
};

testGridFSConnection();
