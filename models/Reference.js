import mongoose from "mongoose";
const { Schema } = mongoose;

// Collection Schema
const collectionSchema = new Schema({
  collectionName: {
    required: true,
    type: String,
  }
});

// Reference Schema
const referenceSchema = new Schema({
  title: {
    required: true,
    type: String,
    maxlength: [20, '최대 글자수를 초과하였습니다.'],
  },
  createAt: {
    required: true,
    type: Date,
    default : Date.now(),
  },
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  memo: {
    type: String,
    maxlength: [500, '최대 글자수를 초과하였습니다.'],
  },
  files: [
    {
      fileType: String,
      originalName: String,
      imageList: [String],
      newName: String,
      filePath: String,
    },
  ],
});

// Keyword Schema
const keywordSchema = new Schema({
  keywordName: {
    required: true,
    type: String,
  }
});

// Refkey Schema for associating Reference and Keyword
const refkeySchema = new Schema({
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reference',
    required: true,
  },
  keywordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Keyword',
    required: true,
  }
});

// List Schema for storing URLs
const listSchema = new Schema({
  listUrl: {
    type: String,
    required: true,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reference',
    required: true,
  }
});

// Model Definitions
const Collection = mongoose.model('Collection', collectionSchema);
const Reference = mongoose.model('Reference', referenceSchema);
const Keyword = mongoose.model('Keyword', keywordSchema);
const Refkey = mongoose.model('Refkey', refkeySchema);
const List = mongoose.model('List', listSchema);

export { Collection, Reference, Keyword, Refkey, List };
