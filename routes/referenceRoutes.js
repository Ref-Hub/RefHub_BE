import express from "express";
import {
  addReference,
  updateReference,
  getReference,
  getReferenceDetail,
  deleteReference,
} from "../Controllers/referenceController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/fileUpload.js";
import downloadFile from "../middlewares/fileDownload.js";

const router = express.Router();

// 레퍼런스 추가
router.post("/", authMiddleware, upload, addReference);

// 레퍼런스 수정
router.patch("/:referenceId", authMiddleware, upload, updateReference);

// 레퍼런스 조회
router.get("/", authMiddleware, getReference);

// 레퍼런스 상세
router.get("/:referenceId", authMiddleware, getReferenceDetail);

// 레퍼런스 삭제
router.delete("/:referenceId", authMiddleware, deleteReference);

// 파일 다운로드
router.get("/file/:id", authMiddleware, downloadFile);

export default router;
