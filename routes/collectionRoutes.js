import { Router } from "express";
import Collection from "../controllers/collectionController.js";
import Sharing from "../controllers/sharingController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import validators from "../middlewares/validators.js";

const router = Router();
const {
  validateTitle,
  validateEmail,
  validateRole,
  validateObjectId,
  validateObjectIdArray,
  validateMiddleware,
} = validators;

router.post(
  "/",
  authMiddleware,
  [validateTitle, validateMiddleware],
  Collection.createCollection
);

// 컬렉션 목록 조회
router.get("/", authMiddleware, Collection.getCollection);

// 컬렉션 삭제
router.delete(
  "/",
  authMiddleware,
  [validateObjectIdArray("collectionIds"), validateMiddleware],
  Collection.deleteCollection
);

// 컬렉션 수정
router.patch(
  "/:collectionId",
  authMiddleware,
  [validateObjectId("collectionId"), validateTitle, validateMiddleware],
  Collection.updateCollection
);

// 컬렉션 즐겨찾기 토글
router.patch(
  "/:collectionId/favorite",
  authMiddleware,
  [validateObjectId("collectionId"), validateMiddleware],
  Collection.toggleFavorite
);

// 나만 보기
router.patch(
  "/:collectionId/sharing/set-private",
  authMiddleware,
  [validateObjectId("collectionId"), validateMiddleware],
  Sharing.setPrivate
);

// 공유 사용자 조회
router.get(
  "/:collectionId/sharing/shared-users",
  authMiddleware,
  [validateObjectId("collectionId"), validateMiddleware],
  Sharing.getSharedUsers
);

// 공유 사용자 수정 및 메일 발송
router.patch(
  "/:collectionId/sharing/shared-users",
  authMiddleware,
  [
    validateObjectId("collectionId"),
    validateEmail,
    validateRole,
    validateMiddleware,
  ],
  Sharing.updateSharedUsers
);

// 공유 사용자 삭제
router.delete(
  "/:collectionId/sharing/shared-users/:userId",
  authMiddleware,
  [
    validateObjectId("collectionId"),
    validateObjectId("userId"),
    validateMiddleware,
  ],
  Sharing.deleteSharedUser
);

export default router;