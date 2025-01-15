import express from 'express';
import {addReference, updateReference} from '../Controllers/referenceControllers.js';

const router = express.Router();

//레퍼런스 추가
router.post('/reference', addReference);

//레퍼런스 수정
router.put('/reference/:referenceId', updateReference);

export default router;