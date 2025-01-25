import express from "express";
import { createCollection } from "../controllers/collectionController.js";

const router = express.Router();

// POST 요청: 콜렉션 생성
router.post("/collection", createCollection);

export default router;