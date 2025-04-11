import mongoose from "mongoose";

const extensionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Collection",
    },
  },
  { versionKey: false }
);

// Index 설정
extensionSchema.index({ userId: 1 }, { unique: true });

const Extension =
  mongoose.models.Extension ||
  mongoose.model(
    "Extension",
    extensionSchema,
    "extensions"
  );

export default Extension;
