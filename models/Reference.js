import mongoose from "mongoose";

const referenceSchema = new mongoose.Schema({
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Collection",
    required: true,
  },
  title: { type: String, required: true, maxLength: 20 },
  keywords: { type: [String], validate: [keywordsValidation, "Invalid keywords"] },
  memo: { type: String, maxLength: 500 },
  files: [
    {
      type: {
        type: String,
        enum: ["link", "image", "pdf", "file"],
        required: true,
      },
      path: { type: String, required: true },
      size: { type: Number, required: true },
      images: { type: [String], default: [] },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

function keywordsValidation(keywords) {
  return keywords.every((kw) => kw.length <= 15);
}

const Reference = mongoose.model("Reference", referenceSchema, "references");
export default Reference;