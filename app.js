import express from "express";
import cors from "cors";
import connectDB from "./db.js";
import dotenv from "dotenv"

import userRoutes from "./routes/userRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import referenceRoutes from "./routes/referenceRoutes.js";
import extensionRoutes from "./routes/extensionRoutes.js"

dotenv.config();

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://refhub.site",
      "https://api.refhub.site",
      "https://refhub.my",
      "https://www.refhub.my",
      "https://refhub.vercel.app",
      `chrome-extension://${process.env.EXTENSION_ID}`,
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
app.use("/api/extensions", extensionRoutes);

app.get("/aws", (req, res) => {
  res.status(200).send("OK");
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server started on port ${PORT} (env: ${process.env.NODE_ENV})`)
);
