import express from 'express';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// 이메일 인증번호 발송 라우터
router.post('/email', userController.authEmail);

// 회원가입 라우터
router.post('/signup', userController.createUser);

// 로그인&로그아웃 라우터
router.post('/login', userController.loginUser);
router.post('/logout', userController.logoutUser);
router.post('/token', userController.refreshAccessToken);

// 유저 정보 조회 라우터 (임시)
router.get('/:email', userController.getUser);

export default router;