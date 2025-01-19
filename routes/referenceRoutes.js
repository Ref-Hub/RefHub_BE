import express from 'express';
import {addReference, updateReference, deleteReference } from '../Controllers/referenceControllers.js';

const router = express.Router();

//레퍼런스 추가
router.post('/reference', addReference);

//레퍼런스 수정
router.put('/reference/:referenceId', updateReference);

//레퍼런스 삭제
router.delete('/reference/:referenceId', deleteReference);

export default router;