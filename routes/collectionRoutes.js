import express from "express";
import collectionController from "../controllers/collectionController.js";
import sharingController from "../controllers/sharingController.js";

const router = express.Router();

// Collection APIs
// 컬렉션 생성
router.post("/", collectionController.createCollection);
// 컬렉션 목록 조회
router.get("/", collectionController.getCollection);
// 컬렉션 삭제
router.delete("/", collectionController.deleteCollection);
// 컬렉션 수정
router.patch("/:collectionId", collectionController.updateCollection);
// 컬렉션 즐겨찾기 토글
router.patch("/:collectionId/favorite", collectionController.toggleFavorite);

// Collection Sharing APIs
// 나만 보기
router.patch(
  "/:collectionId/sharing/set-private",
  sharingController.setPrivate
);
// 공유 사용자 조회
router.get(
  "/:collectionId/sharing/shared-users",
  sharingController.getSharedUsers
);
// 공유 사용자 수정 및 메일 발송
router.patch(
  "/:collectionId/sharing/shared-users",
  sharingController.setSharedUsers,
  sharingController.sendUsers
);
// 공유 사용자 삭제
router.delete(
  "/:collectionId/sharing/shared-users/:userId",
  sharingController.removeSharedUser
);

export default router;
