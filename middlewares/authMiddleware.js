import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    res.status(401).send({ error: "토큰이 없어 권한이 거부되었습니다." });
    return;
  }

  try {
    const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`);
    req.user = decoded; // 토큰에서 사용자 정보 추출
    next();
  } catch (err) {
    res.status(401).send({ error: "유효하지 않은 토큰입니다." });
  }
};
