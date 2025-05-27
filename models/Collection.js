import mongoose from "mongoose";

const collSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxLength: 20,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }
  },
  {
    versionKey: false,
    toJSON: {virtuals: true},
    toObject: {virtuals: true},
    timestamps: true,
  }
);

// Index 설정
collSchema.index({ createdBy: 1, title: 1 });

const Collection =
  mongoose.models.Collection ||
  mongoose.model("Collection", collSchema, "collections");

export default Collection;
