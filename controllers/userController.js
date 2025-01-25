import User from '../models/User.js';
import ejs from 'ejs';
import path from 'path';
import bcrypt from 'bcrypt';
import { smtpTransport } from '../config/email.js';
import jwt from 'jsonwebtoken';
import { validationResult, check } from 'express-validator';

const appDir = path.resolve();

// [유효성 검사]
// name, email, password, confirmPassword 유효성 검사 함수
const validateName = check('name')
  .matches(/^[가-힣a-zA-Z\s]+$/)
  .withMessage('이름은 한글, 영어만 사용할 수 있습니다.')
  .isLength({ max: 10 })
  .withMessage('이름은 최대 10글자까지 입력할 수 있습니다.');

const validateEmail = check('email')
  .isEmail()
  .withMessage('이메일 형식이 옳지 않습니다.');

const validatePassword = check('password')
.matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
.withMessage('비밀번호는 영문(대/소문자), 숫자, 특수문자 2종류 이상의 조합으로 이루어져야 합니다.')
.isLength({ min: 8, max: 12 })
.withMessage('비밀번호는 8~12글자 이내로 입력할 수 있습니다.');

const validateConfirmPassword = check('confirmPassword')
.custom((value, { req }) => value === req.body.password)
.withMessage('비밀번호가 일치하지 않습니다.');

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
    from: process.env.USER,
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).send('이름과 이메일을 모두 입력해주세요.');
    }  

    const verificationCode = Math.floor(100000 + Math.random() * 900000);
    const verificationExpires = Date.now() + 10 * 60 * 1000;

    try {
      await sendVerificationEmail(name, email, verificationCode, '📁RefHub📁 회원가입 인증 번호');

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        existingUser.verificationCode = verificationCode;
        existingUser.verificationExpires = verificationExpires;
        existingUser.name = name;
        await existingUser.save();
      } else {
        await User.create({ name, email, verificationCode, verificationExpires });
      }

      res.status(200).send('인증번호 메일이 전송되었습니다.');
    } catch (error) {
      res.status(500).send('인증번호 메일 전송 중 오류가 발생했습니다.');
    }
  },
];

// 인증번호 검증 및 회원가입 함수
export const createUser = [
  validatePassword,
  validateConfirmPassword,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, verificationCode, password } = req.body;

    if (!email || !verificationCode || !password || !confirmPassword) {
      return res.status(400).send('모든 정보를 입력해주세요.');
    }

    try {
      const user = await User.findOne({ email });

      if (!user || user.verificationCode !== parseInt(verificationCode, 10)) {
        return res.status(400).send('인증번호가 일치하지 않습니다.');
      }

      if (user.verificationExpires < Date.now()) {
        return res.status(400).send('인증번호가 만료되었습니다.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      user.password = hashedPassword;
      user.verificationCode = undefined;
      user.verificationExpires = undefined;

      await user.save();

      res.status(200).send('회원가입이 완료되었습니다.');
    } catch (error) {
      res.status(500).send('회원가입 중 오류가 발생했습니다.');
    }
  },
];

// [로그인]
// 로그인 함수
export const loginUser = [
  validateEmail,
  validatePassword,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, autoLogin = false } = req.body;

    if (!email || !password) {
      return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요.');
    }

    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).send('등록되지 않은 이메일입니다.');
      }

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
  async (req, res) => {
    const { email } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
      res.status(500).send('비밀번호 재설정을 위한 인증번호 메일 전송 중 오류가 발생했습니다.');
    }
  }
];

// 비밀번호 재설정 함수
export const resetPassword = [
  validatePassword,
  validateConfirmPassword,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, verificationCode, newPassword } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user || user.verificationCode !== parseInt(verificationCode, 10)) {
        return res.status(400).send('인증번호가 일치하지 않습니다.');
      }

      if (user.verificationExpires < Date.now()) {
        return res.status(400).send('인증번호가 만료되었습니다.');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.verificationCode = undefined;
      user.verificationExpires = undefined;

      await user.save();

      res.status(200).send('비밀번호가 성공적으로 변경되었습니다.');
    } catch (error) {
      res.status(500).send('비밀번호 변경 중 오류가 발생했습니다.');
    }
  },
];

// 유저 정보 조회 함수 (임시)
export const getUser = async (req, res) => {
  const { email } = req.params;

  if (!email) {
    return res.status(400).send('이메일 입력 X');
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send('유저 X');
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).send('서버 에러');
  }
};
