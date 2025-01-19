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
router.post('/add', upload.array("datas", 5), createReference);

  //레퍼런스 수정 API
  router.put('/:id', async (req, res) => {
    try {
      const { category, title, keywords, memo, resources } = req.body;
      const updatedReference = await Reference.findByIdAndUpdate(
        req.params.id,
        { category, title, keywords, memo, resources },
        { new: true }
      );
      if (!updatedReference) {
        return res.status(404).json({ message: '레퍼런스를 찾지 못하였습니다.' });
      }
      res.status(200).json({ message: '레퍼런스가 성공적으로 수정되었습니다.', reference: updatedReference });
    } catch (error) {
      res.status(500).json({ message: '레퍼런스 수정 오류', error });
    }
  });

  export default router;