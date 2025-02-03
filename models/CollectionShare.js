import mongoose from "mongoose";

const collectionShareSchema = new mongoose.Schema(
  {
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["viewer", "editor"],
      default: "viewer",
    },
  },
  { versionKey: false }
);

// 하나의 컬렉션에 대해 한 유저는 하나의 권한만 가질 수 있도록
collectionShareSchema.index({ collectionId: 1, userId: 1 }, { unique: true });

const CollectionShare =
  mongoose.models.CollectionShare ||
  mongoose.model("CollectionShare", collectionShareSchema, "collectionShares");

export default CollectionShare;
