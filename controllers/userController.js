import User from '../models/User.js';
import Collection from '../models/Collection.js';
import CollectionShare from '../models/CollectionShare.js';
import ejs from 'ejs';
import path from 'path';
import bcrypt from 'bcrypt';
import { smtpTransport } from '../config/email.js';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middlewares/authenticate.js';
import validators from '../middlewares/validators.js';

const { validateName, validateEmail, validatePassword, validateNewPassword, validateConfirmPassword, validateNewConfirmPassword, validateMiddleware } = validators;

const appDir = path.resolve();

// [회원가입]
// 이메일 인증번호 발송 함수
const sendVerificationEmail = async (name, email, verificationCode, subject) => {
  let templateFile;
  
  if (subject === '📁RefHub📁 회원가입 인증 번호') {
    templateFile = 'authEmail.ejs';
  } else if (subject === '📁RefHub📁 비밀번호 재설정 인증 번호') {
    templateFile = 'authPassword.ejs';
  };

  const emailTemplatePath = path.join(appDir, 'templates', templateFile);
  const emailTemplate = await ejs.renderFile(emailTemplatePath, { authCode: verificationCode, name });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    html: emailTemplate,
    attachments: [
      {
        filename: 'logo.png',
        path: path.join(appDir, 'templates', 'logo.png'),
        cid: 'logo'
      }
    ]
  };

  return smtpTransport.sendMail(mailOptions);
};

// 이메일 인증 함수
export const authEmail = [
  validateName,
  validateEmail,
  validateMiddleware,
  async (req, res) => {
    const { name, email } = req.body;

    const verificationCode = Math.floor(100000 + Math.random() * 900000);
    const verificationExpires = Date.now() + 10 * 60 * 1000;

    try {
      const existingUser = await User.findOne({ email });

      if (existingUser && existingUser.password) {
        return res.status(400).send('이미 가입된 이메일입니다.');
      }

      if (existingUser) {
        existingUser.verificationCode = verificationCode;
        existingUser.verificationExpires = verificationExpires;
        await existingUser.save();
      } else {
        await User.create({ name, email, verificationCode, verificationExpires });
      }

      await sendVerificationEmail(name, email, verificationCode, '📁RefHub📁 회원가입 인증 번호');

      res.status(200).send('인증번호 메일이 전송되었습니다.');
    } catch (error) {
      console.error('인증번호 메일 전송 중 오류가 발생했습니다.:', error);
      res.status(500).send('인증번호 메일 전송 중 오류가 발생했습니다.');
    }
  },
];

// 인증번호 검증 함수
export const verifyCode = async (req, res) => {
  const { email, verificationCode } = req.body;

  if (!email || !verificationCode) {
    return res.status(400).send('이메일과 인증번호를 입력해주세요.');
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).send('사용자를 찾을 수 없습니다.');
    }

    if (user.verificationExpires < Date.now()) {
      return res.status(400).send('인증번호가 만료되었습니다.');
    }

    if (user.verificationCode !== parseInt(verificationCode, 10)) {
      return res.status(400).send('인증번호가 일치하지 않습니다.');
    }

    // 인증 성공 처리
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    req.body.verifiedEmail = email;

    res.status(200).send('인증번호가 확인되었습니다.');
  } catch (error) {
    console.error('인증번호 검증 중 오류가 발생했습니다.:', error);
    res.status(500).send('인증번호 검증 중 오류가 발생했습니다.');
  }
};

// 회원가입 함수
export const createUser = [
  validatePassword,
  validateConfirmPassword,
  validateMiddleware,
  async (req, res) => {
    const { verifiedEmail, password, confirmPassword,  } = req.body;

    if (!verifiedEmail || !password || !confirmPassword) {
      return res.status(400).send('모든 정보를 입력해주세요.');
    }

    try {
      const user = await User.findOne({ email: verifiedEmail });

      if (!user) {
        return res.status(400).send('사용자를 찾을 수 없습니다.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      user.password = hashedPassword;
      user.verificationCode = undefined;
      user.verificationExpires = undefined;

      await user.save();

      res.status(200).send('회원가입이 완료되었습니다.');
    } catch (error) {
      console.error('회원가입 중 오류가 발생했습니다.:', error);
      res.status(500).send('회원가입 중 오류가 발생했습니다.');
    }
  },
];

// 회원탈퇴 함수
export const deleteUser = async (req, res) => {
  await authenticate(req, res, async () => {
    const { user } = req;

    if (!user) {
      return res.status(400).send('사용자 정보를 찾을 수 없습니다.');
    }

    try {
      // 공유 중인 컬렉션이 있는지 확인
      const ownedCollections = await Collection.find({ createdBy: user._id }).distinct("_id");

      const sharedOwnedCollections = await CollectionShare.find({
        collectionId: { $in: ownedCollections },
      });

      if (sharedOwnedCollections.length > 0) {
        return res.status(400).send('공유 중인 컬렉션이 있어 탈퇴할 수 없습니다.');
      }

      user.deleteRequestDate = new Date();
      await user.save();

      res.status(200).send('탈퇴가 완료되었습니다. 7일 이내에 로그인할 경우, 계정이 복구됩니다.');
    } catch (error) {
      console.error('회원탈퇴 중 오류가 발생했습니다.', error);
      res.status(500).send('회원탈퇴 중 오류가 발생했습니다.');
    }
  });
};

// [로그인]
// 로그인 함수
export const loginUser = [
  validateEmail,
  validateMiddleware,
  async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요.');
    }

    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).send('등록되지 않은 이메일입니다.');
      }

      // 탈퇴 요청 후 7일 이내에 로그인 시도 시 복구
      if (user.deleteRequestDate && new Date() - user.deleteRequestDate < 7 * 24 * 60 * 60 * 1000) {
        user.deleteRequestDate = undefined;
        await user.save();
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('로그인 중 오류가 발생했습니다.:', error);
      res.status(500).send('로그인 중 오류가 발생했습니다.');
    }
  },
  validatePassword,
  validateMiddleware,
  async (req, res) => {
    const { password, autoLogin = false } = req.body;
    const user = req.user;

    try {
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(400).send('비밀번호가 올바르지 않습니다.');
      }

      const accessToken = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      let refreshToken = null;
      if (autoLogin) {
        refreshToken = jwt.sign(
          { id: user._id, email: user.email },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );
      }

      res.status(200).json({ message: '로그인이 완료되었습니다.', accessToken, refreshToken, autoLogin });
    } catch (error) {
      console.error('로그인 중 오류가 발생했습니다.:', error);
      res.status(500).send('로그인 중 오류가 발생했습니다.');
    }
  },
];

// 로그아웃 함수
export const logoutUser = async (req, res) => {
  res.status(200).send('로그아웃이 완료되었습니다.');
};

// 토큰 갱신 함수
export const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).send('Refresh Token이 없습니다.');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // 새로운 Access Token 발급
    const newAccessToken = jwt.sign(
      { id: decoded.id, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(403).send('토큰 갱신 중 오류가 발생했습니다. 유효하지 않은 Refresh Token입니다.');
  }
};

// [비밀번호 재설정]
// 비밀번호 재설정을 위한 인증번호 발송 함수
export const resetPasswordEmail = [
  validateEmail,
  validateMiddleware,
  async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send('이메일을 입력해주세요.');
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000);
    const verificationExpires = Date.now() + 10 * 60 * 1000;

    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).send('등록되지 않은 이메일입니다.');
      }

      user.verificationCode = verificationCode;
      user.verificationExpires = verificationExpires;
      await user.save();

      await sendVerificationEmail(user.name, email, verificationCode, '📁RefHub📁 비밀번호 재설정 인증 번호');

      res.status(200).send('비밀번호 재설정을 위한 인증번호가 발송되었습니다.');
    } catch (error) {
      console.error('인증번호 메일 전송 중 오류가 발생했습니다.:', error);
      res.status(500).send('비밀번호 재설정을 위한 인증번호 메일 전송 중 오류가 발생했습니다.');
    }
  }
];

// 비밀번호 재설정 함수
export const resetPassword = [
  validateNewPassword,
  validateNewConfirmPassword,
  validateMiddleware,
  async (req, res) => {
    const { email, verificationCode, newPassword } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).send('사용자를 찾을 수 없습니다.');
      }

      if (user.verificationExpires < Date.now()) {
        return res.status(400).send('인증번호가 만료되었습니다.');
      }

      if (user.verificationCode !== parseInt(verificationCode, 10)) {
        return res.status(400).send('인증번호가 일치하지 않습니다.');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.verificationCode = undefined;
      user.verificationExpires = undefined;

      await user.save();

      res.status(200).send('비밀번호가 성공적으로 변경되었습니다.');
    } catch (error) {
      console.error('비밀번호 변경 중 오류가 발생했습니다.:', error);
      res.status(500).send('비밀번호 변경 중 오류가 발생했습니다.');
    }
  },
];
