import mongoose from "mongoose";

const mongoURI = process.env.MONGO_URI;

// db 연결
const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB가 연결되었습니다.");
  } catch (err) {
    console.error("MongoDB가 연결되지 않았습니다.", err);
    process.exit(1); // 연결 실패 시 프로그램 종료
  }
};

export default connectDB;

