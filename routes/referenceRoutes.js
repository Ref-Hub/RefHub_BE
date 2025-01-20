import express from 'express';
import { Collection, Reference, Keyword, Refkey } from '../models/Reference.js';
import { createReference } from '../controllers/referenceController.js';
import { upload } from '../middlewares/fileUpload.js';
import path from 'path';

const router = express.Router();

// 에러 처리 핸들러
function asyncHandler(handler) {
    return async function (req, res) {
        try {
            await handler(req, res);
        } catch (e) {
            if (e.name === 'ValidationError') {
                res.status(400).send({ message: e.message });
            } else if (e.name === 'CastError') {
                res.status(404).send({ message: 'Cannot find given id.' });
            } else {
                res.status(500).send({ message: e.message });
            }
        }
    };
}

//레퍼런스 추가 API
router.post('/add', upload.array("files", 5), createReference);

  

export default router;