import mongoose from "mongoose";

const collSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxLength: 20,
    },
    isFavorite: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: { type: Date, default: () => Date.now() },
  },
  { versionKey: false }
);

// Index 설정 (createdBy와 title의 조합을 유니크로 설정)
collSchema.index({ createdBy: 1, title: 1 }, { unique: true });

const Collection =
  mongoose.models.Collection ||
  mongoose.model("Collection", collSchema, "collections");
export default Collection;
