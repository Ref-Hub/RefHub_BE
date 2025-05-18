import passport from 'passport';
import jwt from 'jsonwebtoken';

export const kakaoLogin = passport.authenticate('kakao', {
  scope: ['account_email', 'profile_nickname'],
});

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
