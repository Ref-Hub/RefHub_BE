import express from 'express';
import passport from 'passport';

import * as userController from '../controllers/userController.js';
import * as kakaoController from '../controllers/kakaoController.js';

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/profileUpload.js"

const router = express.Router();

// 이메일 인증번호 발송 라우터
router.post('/email', userController.authEmail);

// 회원가입 라우터
router.post('/verify-code', userController.verifyCode);
router.post('/signup', userController.createUser);

// 회원탈퇴 라우터
router.delete('/delete', userController.deleteUser);

// 로그인&로그아웃 라우터
router.post('/login', userController.loginUser);
router.post('/logout', userController.logoutUser);
router.post('/token', userController.refreshAccessToken);

// 비밀번호 재설정 라우터
router.post('/password/email', userController.resetPasswordEmail);
router.post('/password/reset', userController.resetPassword);

// 카카오 로그인 라우터
router.get('/kakao', kakaoController.kakaoLogin);
router.get(
  '/kakao/callback',
  passport.authenticate('kakao', { failureRedirect: '/login', session: false }),
  kakaoController.kakaoCallback
);

// 마이페이지 
router.get('/my-page', authMiddleware, userController.myPage);
router.patch('/profile-image', authMiddleware, upload.single("file"), userController.resetProfileImage);
router.delete('/profile-image', authMiddleware, userController.deleteProfileImage);
router.patch('/user-name', authMiddleware, userController.resetUserName);

export default router;