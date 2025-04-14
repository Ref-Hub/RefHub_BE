import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import {
  authCheckEx,
  addReferenceEx,
} from "../controllers/extensionController.js";
import { uploadEx } from "../middlewares/fileUpload.js";

const router = Router();

router.get("/authCheck", authenticate, authCheckEx);
router.post("/add", authenticate, uploadEx, addReferenceEx);

export default router;
