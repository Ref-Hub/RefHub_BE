import Collection from "../models/Collection.js";
import CollectionShare from "../models/CollectionShare.js";

// editor 권한 확인 (생성자 또는 editor)
export const hasEditorAccess = async (userId, collectionId) => {
  const collection = await Collection.findOne({ _id: collectionId, createdBy: userId });
  if (collection) return true;
  const share = await CollectionShare.findOne({ collectionId, userId, role: "editor" });
  return !!share;
};

// viewer 권한 확인 (생성자 또는 공유 사용자 전체)
export const hasViewerAccess = async (userId, collectionId) => {
  const collection = await Collection.findOne({ _id: collectionId, createdBy: userId });
  if (collection) return true;
  const share = await CollectionShare.findOne({ collectionId, userId });
  return !!share;
};
