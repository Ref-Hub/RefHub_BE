import mongoose from "mongoose";
import Collection from "../models/collection.js";
import { StatusCodes } from "http-status-codes";

export const createCollection = async (req, res, next) => {
  const { title } = req.body;
  const createdBy = "67851e7cd00c4a5843c88303"; // 유저 ID (예시), 실제 환경에서는 req.user.id 등을 사용

  try {
    // 새로운 Collection 생성
    const newCollection = await Collection.create({
      title: title,
      createdBy: createdBy,
    });

    // 성공 응답
    res.status(StatusCodes.CREATED).json({
      message: "Collection created successfully.",
      collection: newCollection,
    });
  } catch (err) {
    // 중복된 타이틀 에러 처리
    if (err.code === 11000) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Collection with the same title already exists.",
      });
    }

    // 유효성 검사 에러 처리
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: err.message,
      });
    }

    // 기타 에러 처리
    console.error("Error creating collection:", err);
    next(err);
  }
};