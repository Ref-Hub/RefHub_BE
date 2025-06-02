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
          return done(new Error('카카오 계정에 이메일이 없습니다.'), null);
        }

        const user = await User.findOne({ email: kakaoEmail });

        if (user) {
          // 계정 복구 체크
          let recovered = false;
          if (user.deleteRequestDate) {
            const timeElapsed = new Date() - user.deleteRequestDate;
            
            if (timeElapsed >= 7 * 24 * 60 * 60 * 1000) {
              // 7일이 지난 경우 계정 삭제
              await User.deleteOne({ _id: user._id });
              return done(new Error('계정이 삭제되었습니다. 다시 가입해주세요.'), null);
            }
            
            // 7일 이내 로그인 시 계정 복구
            user.deleteRequestDate = undefined;
            recovered = true;
            await user.save();
          }

          // 로컬 가입자인 경우 프론트로 연동 필요 전달
          if (user.provider === 'local') {
            return done(null, false, {
              message: 'link_required',
              email: kakaoEmail,
              profileData: {
                profile_image_url: kakaoAccount.profile?.profile_image_url,
                name: profile.displayName,
              },
            });
          }
          
          // 복구 정보를 user 객체에 추가
          user.recovered = recovered;
          return done(null, user);
        }

        const newUser = await User.create({
          name: profile.displayName,
          email: kakaoEmail,
          password: '',
          profileImage: kakaoAccount.profile?.profile_image_url || '',
          provider: 'kakao',
        });

        console.log('신규 유저 생성 완료:', newUser.email);
        return done(null, newUser);
      } catch (err) {
        console.error('카카오 전략 내부 에러:', err.message);
        return done(err, null);
      }
    }
  )
);
