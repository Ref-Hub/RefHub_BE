import express from "express";
import cors from "cors";
import connectDB from "./db.js";
import userRoutes from "./routes/userRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import referenceRoutes from "./routes/referenceRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB 연결
connectDB();

// 에러 처리 미들웨어
const errorHandler = (err, req, res, next) => {
  console.error("Error: ", err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
};


// 라우트 설정
app.use("/api/users", userRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/references", referenceRoutes);

app.use(errorHandler);
app.listen(process.env.PORT || 3000, () =>
  console.log("Server Started")
);
