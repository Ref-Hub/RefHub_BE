import express from 'express';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// 이메일 인증번호 발송 라우터
router.post('/email', userController.authEmail);

// 회원가입 라우터
router.post('/verify-code', userController.verifyCode);
router.post('/signup', userController.createUser);

// 로그인&로그아웃 라우터
router.post('/login', userController.loginUser);
router.post('/logout', userController.logoutUser);
router.post('/token', userController.refreshAccessToken);

// 비밀번호 재설정 라우터
router.post('/password/email', userController.resetPasswordEmail);
router.post('/password/reset', userController.resetPassword);

export default router;