import passport from 'passport';
import { Strategy as KakaoStrategy } from 'passport-kakao';
import User from '../models/User.js';

passport.use(
  new KakaoStrategy(
    {
      clientID: process.env.KAKAO_REST_API_KEY,
      callbackURL: process.env.KAKAO_REDIRECT_URI,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const kakaoAccount = profile._json.kakao_account;
        console.log('카카오 로그인 이메일:', kakaoAccount.email);

        if (!kakaoAccount.email) {
          console.error('이메일 없음');
          return done(new Error('이메일 누락'), null);
        }

        let user = await User.findOne({ email: kakaoAccount.email });

        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email: kakaoAccount.email,
            password: '',
            profileImage: kakaoAccount.profile?.profile_image_url,
            provider: 'kakao',
          });
        }

        return done(null, user);
      } catch (err) {
        console.error('카카오 전략 내부 에러:', err);
        return done(err, null);
      }
    }
  )
);