import passport from 'passport';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 카카오 로그인
export const kakaoLogin = passport.authenticate('kakao', {
  scope: ['account_email', 'profile_nickname'],
});

// 카카오 로그인 콜백
export const kakaoCallbackHandler = (req, res, next) => {
  passport.authenticate('kakao', { session: false }, (err, user, info) => {
    const redirectBase =
      process.env.NODE_ENV === 'production'
        ? 'https://www.refhub.my'
        : 'http://localhost:5173';

    if (info?.message === 'link_required') {
      const email = info.email;
      const profileImage = info.profileData?.profile_image_url || '';
      const name = info.profileData?.name || '';

      return res.redirect(
        `${redirectBase}/users/kakao-login?link=true&email=${email}&name=${encodeURIComponent(
          name
        )}&profileImage=${encodeURIComponent(profileImage)}`
      );
    }

    if (err || !user) {
      console.error('카카오 로그인 실패:', err || 'user 없음');
      return res.redirect(`${redirectBase}/login`);
    }

    req.user = user;
    next();
  })(req, res, next);
};

// 카카오 로그인 완료 후 JWT 발급
export const kakaoCallback = (req, res) => {
  const user = req.user;

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const redirectBase =
    process.env.NODE_ENV === 'production'
      ? 'https://www.refhub.my'
      : 'http://localhost:5173';

  res.redirect(`${redirectBase}/users/kakao-login?token=${token}`);
};

// 카카오 계정 연동 API
export const linkKakaoAccount = async (req, res) => {
  const { email, name, profileImage } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || user.provider !== 'local') {
      return res.status(400).json({ error: '카카오 계정으로 연동할 수 없는 계정입니다.' });
    }

    user.provider = 'kakao';
    user.password = '';
    user.name = name || user.name;
    user.profileImage = profileImage || user.profileImage;

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({ message: '연동이 완료되었습니다.', token });
  } catch (err) {
    console.error('카카오 계정 연동 오류:', err);
    res.status(500).json({ error: '카카오 계정 연동 중 오류가 발생했습니다.' });
  }
};