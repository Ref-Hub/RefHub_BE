// models/OGImageCache.js
import mongoose from "mongoose";

const OGImageCacheSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      unique: true,
      index: true, // URL로 빠르게 검색하기 위해 인덱스 추가
    },
    imageUrl: {
      type: String,
      default: null, // OG Image URL이 없는 경우를 대비
    },
    createdAt: {
      type: Date,
      default: Date.now, // 기준 시작 시점
      expires: 604800, // 7일 후 자동 삭제
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성 (createdAt은 TTL 인덱스에 사용)
  }
);

const OGImageCache = mongoose.model("OGImageCache", OGImageCacheSchema);

export default OGImageCache;
