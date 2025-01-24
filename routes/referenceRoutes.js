import express from "express";
import {
  addReference,
  updateReference,
  getReferenceDetail,
  deleteReference,
} from "../Controllers/referenceController.js";
import { upload } from "../middlewares/fileUpload.js";
import downloadFile from "../middlewares/fileDownload.js";

const router = express.Router();

// 레퍼런스 추가
router.post("/reference", upload, addReference);

// 레퍼런스 수정
router.patch("/reference/:referenceId", upload, updateReference);

// 레퍼런스 상세 조회
router.get("/reference/:referenceId", getReferenceDetail);

// 레퍼런스 삭제
router.delete("/reference/:referenceId", deleteReference);

// 파일 다운로드
router.get("/file/:id", downloadFile);

export default router;
