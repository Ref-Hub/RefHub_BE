import express from "express";
import cors from "cors";
import connectDB from "./db.js";
// import jwt from "jsonwebtoken";

import userRoutes from "./routes/userRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import referenceRoutes from "./routes/referenceRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB 연결
connectDB();

/*
// Token Test Code

const payload = {
  id: "67851e7cd00c4a5843c88303",
  email: "yyj9694651@gmail.com",
};
const secret = process.env.JWT_SECRET;
const token = jwt.sign(payload, secret, { expiresIn: "1h" });
console.log(token);

if (!token) {
  res.status(401).send({ error: "No token, authorization denied" });
}
  */

// 에러 처리 미들웨어
const errorHandler = (err, req, res, next) => {
  console.error("Error: ", err);
  res
    .status(500)
    .json({ error: "서버 오류가 발생했습니다." });
};

// 라우트 설정
app.use("/api/users", userRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/reference", referenceRoutes);

app.use(errorHandler);
app.listen(process.env.PORT || 3000, () => console.log("Server Started"));
