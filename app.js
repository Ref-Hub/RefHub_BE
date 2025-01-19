"use strict";

import express from "express";
import dotenv from "dotenv";
import connectDB from "./db/connect.js";
import { StatusCodes } from "http-status-codes";
import cors from "cors";
import Collection from "./models/Collection.js";
import User from "./models/User.js";
import collectionRoutes from "./routes/collectionRoutes.js";

// .env 설정
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
connectDB();

// 에러 처리 미들웨어
const errorHandler = (err, req, res, next) => {
  console.error("Error: ", err);
  res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ message: "서버 오류가 발생했습니다." });
};

// app.use("/users", userRoutes);
// app.use("/collections/references", referenceRoutes);
app.use("/collections", collectionRoutes);

// 테스트용 API
app.get("/", async (req, res, next) => {
  console.log("hello world!");
  res.status(StatusCodes.OK).json({ message: "접속 성공" });
});

app.use(errorHandler);
app.listen(process.env.PORT || 3000, () => console.log("Server Started"));
