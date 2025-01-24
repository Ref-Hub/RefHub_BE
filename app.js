import express from "express";
import dotenv from "dotenv";
import connectDB from "./db.js"
import { StatusCodes } from "http-status-codes";
import cors from "cors";
import collectionRoutes from "./routes/collectionRoutes.js";
import jwt from "jsonwebtoken";

// .env 설정
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
connectDB();

// // Token Test Code

// const payload = {
//   id: "67851e7cd00c4a5843c88303",
//   email: "yyj9694651@gmail.com",
// };
// const secret = process.env.JWT_SECRET;
// const token = jwt.sign(payload, secret, { expiresIn: "1h" });
// console.log(token);

// if (!token) {
//   res.status(401).send({ error: "No token, authorization denied" });
// }

// 에러 처리 미들웨어
const errorHandler = (err, req, res, next) => {
  console.error("Error: ", err);
  res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: "서버 오류가 발생했습니다." });
};

// app.use("/users", userRoutes);
// app.use("/collections/references", referenceRoutes);
app.use("/collections", collectionRoutes);

// 테스트용 API
app.get("/", async (req, res, next) => {
  try {
    console.log("hello world!");
    res.status(StatusCodes.OK).json({ message: "접속 성공" });
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);
app.listen(process.env.PORT || 3000, () => console.log("Server Started"));
