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
        const kakaoEmail = kakaoAccount?.email;

        console.log('카카오 로그인 이메일:', kakaoEmail);

        if (!kakaoEmail) {
          console.error('이메일 정보가 없습니다.');
          return done(new Error('카카오 계정에 이메일이 없습니다.'), null);
        }

        let user = await User.findOne({ email: kakaoEmail });

        // if (user && user.provider !== 'kakao') {
        //   console.error('이미 이메일로 가입된 유저입니다.');
        //   return done(new Error('이미 가입된 이메일입니다. 이메일 로그인을 이용하세요.'), null);
        // }

        if (!user) {
          user = await User.create({
            name: profile.displayName,
            email: kakaoEmail,
            password: '',
            profileImage: kakaoAccount.profile?.profile_image_url || '',
            provider: 'kakao',
          });

          console.log('신규 유저 생성 완료:', user.email);
        } else {
          console.log('기존 유저 로그인:', user.email);
        }

        return done(null, user);
      } catch (err) {
        console.error('카카오 전략 내부 에러:', err.message);
        return done(err, null);
      }
    }
  )
);
