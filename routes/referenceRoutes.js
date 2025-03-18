import express from "express";
import {
  getColList,
  addReference,
  updateReference,
  getReference,
  getReferenceDetail,
  deleteReference,
  deleteReferences,
  moveReferences,
} from "../controllers/referenceController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/fileUpload.js";
import { downloadFileFromS3 } from "../middlewares/fileDownload.js";

const router = express.Router();

// 파일 다운로드
router.get("/download", authMiddleware, downloadFileFromS3);

// 레퍼런스 추가
router.post("/add", authMiddleware, upload, addReference);
router.get("/add", authMiddleware, getColList);

// 레퍼런스 수정
router.patch("/:referenceId", authMiddleware, upload, updateReference);

// 레퍼런스 조회
router.get("/", authMiddleware, getReference);

// 레퍼런스 상세
router.get("/:referenceId", authMiddleware, getReferenceDetail);

// 레퍼런스 삭제
router.delete("/:referenceId", authMiddleware, deleteReference);

// 레퍼런스 삭제 (여러개)
router.delete("/", authMiddleware, deleteReferences);

// 레퍼런스 이동 
router.patch("/", authMiddleware, moveReferences);

export default router;
