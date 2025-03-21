import mongoose from "mongoose";

const keywordSchema = new mongoose.Schema({
  keywordName: { type: String, required: true, maxLength: 15, unique: true }
});

const Keyword = mongoose.model("Keyword", keywordSchema, "keywords");

export default Keyword;
