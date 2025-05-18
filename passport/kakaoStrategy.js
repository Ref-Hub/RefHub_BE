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
        const kakaoEmail = profile._json.kakao_account.email;
        const name = profile.displayName;
        const profileImage =
          profile._json.kakao_account.profile?.profile_image_url || null;

        let user = await User.findOne({ email: kakaoEmail });

        if (!user) {
          user = await User.create({
            name,
            email: kakaoEmail,
            password: '',
            profileImage,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

