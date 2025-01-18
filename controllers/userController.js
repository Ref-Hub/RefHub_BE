import ejs from 'ejs';
import path from 'path';
import bcrypt from 'bcrypt';
import { smtpTransport } from '../config/email.js';
import User from '../models/User.js';

const appDir = path.resolve();

// [회원가입]
// 이메일 인증번호 발송 함수
const sendVerificationEmail = async (name, email, verificationCode) => {
  const emailTemplatePath = path.join(appDir, 'templates', 'authEmail.ejs');
  const emailTemplate = await ejs.renderFile(emailTemplatePath, { authCode: verificationCode, name });

  const mailOptions = {
    from: process.env.USER,
    to: email,
    subject: '📁[RefHub] 계정 인증📁',
    html: emailTemplate,
  };

  return smtpTransport.sendMail(mailOptions);
};

// 이메일 인증 함수
export const authEmail = async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).send('이름과 이메일을 모두 입력해주세요.');
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000);
  const verificationExpires = Date.now() + 10 * 60 * 1000;

  try {
    await sendVerificationEmail(name, email, verificationCode);

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
};

// 인증번호 검증 및 회원가입 함수
export const createUser = async (req, res) => {
  const { email, verificationCode, password, confirmPassword } = req.body;

  if (!email || !verificationCode || !password || !confirmPassword) {
    return res.status(400).send('모든 정보를 입력해주세요.');
  }

  if (password !== confirmPassword) {
    return res.status(400).send('비밀번호가 일치하지 않습니다.');
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
};

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
