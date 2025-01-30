import mongoose from "mongoose";

const collectionFavoriteSchema = new mongoose.Schema(
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

collectionFavoriteSchema.index(
  { collectionId: 1, userId: 1 },
  { unique: true }
);

const CollectionFavorite = mongoose.model(
  "CollectionFavorite",
  collectionFavoriteSchema,
  "collectionFavorites"
);

export default CollectionFavorite;
