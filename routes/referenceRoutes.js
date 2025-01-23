import express from 'express';
import {createReference, updateReference, getReferenceDetails, createCollection} from '../Controllers/referenceController.js';

const router = express.Router();

//레퍼런스 추가
router.post('/reference', createReference);

// 레퍼런스 수정 라우터
router.put('/reference/:referenceId', updateReference);

// 레퍼런스 상세보기 라우터
router.get('/reference/:referenceId', getReferenceDetails);

//콜렉션 추가
router.post('/collection', createCollection);

export default router;