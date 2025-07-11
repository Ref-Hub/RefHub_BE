import mongoose from "mongoose";

const referenceSchema = new mongoose.Schema({
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Collection",
    required: true,
  },
  title: { type: String, required: true, maxLength: 20 },
  keywords: [{ type: mongoose.Schema.Types.ObjectId, ref: "Keyword" }],
  memo: { type: String, maxLength: 500 },
  files: [
    {
      type: {
        type: String,
        enum: ["link", "image", "pdf", "file"],
        required: true,
      },
      path: { type: String, required: true }, // GridFS ObjectID 대신 S3 URL 저장
      size: { type: String, required: true },
      previewURLs: {type: [String]},
      previewURL: { type: String },
      filenames: { type: [String] },
      filename: { type: String },
    },
  ],  
},
  { versionKey: "__v", optimisticConcurrency: true, timestamps: true, }
);

referenceSchema.index({updatedAt: -1});

function keywordsValidation(keywords) {
  return keywords.every((kw) => kw.length <= 15);
}

const Reference = mongoose.model("Reference", referenceSchema, "references");
export default Reference;
