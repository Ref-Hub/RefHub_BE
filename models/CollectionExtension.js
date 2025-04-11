import mongoose from "mongoose";

const collectionExtensionSchema = new mongoose.Schema(
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
collectionExtensionSchema.index({ userId: 1 }, { unique: true });

const CollectionExtension =
  mongoose.models.CollectionExtension ||
  mongoose.model(
    "CollectionExtension",
    collectionExtensionSchema,
    "collectionExtensions"
  );

export default CollectionExtension;
