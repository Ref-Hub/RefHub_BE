import { check, validationResult } from "express-validator";

const validateTitle = check("title")
  .trim()
  .isLength({ min: 1, max: 20 })
  .withMessage("제목은 1자 이상, 20자 이하로 입력해주세요.");

const validateEmail = check("email")
  .trim()
  .isEmail()
  .withMessage("이메일 형식이 옳지 않습니다.");

const validateRole = check("role")
  .optional()
  .custom((value) => {
    const validRoles = ["viewer", "editor"];
    if (!validRoles.includes(value)) {
      throw new Error("role은 'viewer' 또는 'editor'여야 합니다.");
    }
    return true;
  });

const validateObjectId = (field) => {
  return check(field)
    .isMongoId()
    .withMessage(`${field}는 유효한 ObjectId 형식이어야 합니다.`);
};

const validateObjectIdArray = (field) => {
  return check(field)
    .isArray()
    .withMessage(`${field}는 배열 형식어야 합니다.`)
    .notEmpty()
    .withMessage("값이 없습니다.")
    .custom((value) => {
      if (Array.isArray(value)) {
        const isValid = value.every((item) => /^[0-9a-fA-F]{24}$/.test(item));
        if (!isValid) {
          throw new Error(
            `${field} 내의 요소는 유효한 ObjectId 형식이어야 합니다.`
          );
        }
      }
      return true;
    });
};

const validateMiddleware = async (req, res, next) => {
  const errors = validationResult(req); // 유효성 검사 결과
  if (!errors.isEmpty()) {
    // 유효성 검사 실패 시, 400 상태 코드와 에러 메시지 반환
    res.status(400).json({ errors: errors.array()[0].msg });
    return;
  }
  next(); // 유효성 검사 통과 시, 다음 미들웨어로 요청을 넘깁니다.
};

export default {
  validateRole,
  validateTitle,
  validateEmail,
  validateObjectId,
  validateObjectIdArray,
  validateMiddleware,
};
