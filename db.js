import dotenvFlow from "dotenv-flow";
dotenvFlow.config();
import mongoose from "mongoose";

const mongoURI =
  process.env.NODE_ENV === "production"
    ? process.env.MONGO_URI_PROD
    : process.env.MONGO_URI_DEV;

// db 연결
const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB가 연결되었습니다.");
  } catch (err) {
    console.error("MongoDB가 연결되지 않았습니다.", err);
    process.exit(1);
  }
};

export default connectDB;
