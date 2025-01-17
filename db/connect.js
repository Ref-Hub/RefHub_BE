"use strict";
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// .env 파일을 로드하여 환경 변수 설정
dotenv.config({ path: __dirname + "/../.env" });

const connectDB = async () => {
  try {
    const mongoURI = process.env.DB_URI;
    if (!mongoURI) {
      throw new Error("MongoDB URI가 설정되지 않았습니다.");
    }
    await mongoose.connect(mongoURI);
    console.log("MongoDB 연결 성공");
  } catch (err) {
    console.error("MongoDB 연결 실패:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
