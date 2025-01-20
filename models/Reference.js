import mongoose from "mongoose";
const { Schema } = mongoose;

// collection 스키마 
const collectionSchema = new Schema({
  collectionName: {
    required: true,
    type: String,
  }
});
// reference 스키마 
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
// keyword
const keywordSchema = new Schema({
  keywordName: {
      require: true,
      type: String,
  }
});
// keyword를 갖는 reference
const refkeySchema = new Schema ({
  referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reference',
      require: true,
  },
  keywordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Keyword',
    require: true,
  }
});
const listSchema = new Schema({
  listUrl: {
    type: String,
    require: true,
  },
  referenceId:{
    type: mongoose.Schema.Types.ObjectId,
      ref: 'Reference',
      require: true,
  }
})


// 모델 정의 
  const Collection = mongoose.model('Collection', collectionSchema);
  const Reference = mongoose.model('Reference', referenceSchema);
  const Keyword = mongoose.model('Keyword', keywordSchema);
  const Refkey = mongoose.model('Refkey', refkeySchema);
  const List = mongoose.model('List', listSchema);

export { Collection, Reference, Keyword, Refkey, List };