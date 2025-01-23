import express from 'express';
import { Collection, Reference, Keyword, Refkey, List } from '../models/Reference.js';
import path from 'path';
import fs from 'fs';

// 에러 처리 핸들러
function asyncHandler(handler) {
    return async function (req, res) {
        try {
            await handler(req, res);
        } catch (e) {
            if (e.name === 'ValidationError') {
                res.status(400).send({ message: e.message });
            } else if (e.name === 'CastError') {
                res.status(404).send({ message: 'Cannot find given id.' });
            } else {
                res.status(500).send({ message: e.message });
            }
        }
    };
}

// 콜렉션 추가(테스트)
export const createCollection = async (req, res) => {
  try {
    const { collectionName } = req.body;

    // 필수 입력값 체크
    if (!collectionName) {
      return res.status(400).json({ message: "컬렉션 이름을 입력해 주세요." });
    }

    // 동일한 이름의 컬렉션이 존재하는지 확인
    const existingCollection = await Collection.findOne({ collectionName });
    if (existingCollection) {
      return res.status(400).json({ message: `${collectionName} 이름을 갖는 컬렉션이 이미 존재합니다.` });
    }

    // 새로운 컬렉션 생성
    const newCollection = new Collection({
      collectionName,
    });

    const savedCollection = await newCollection.save();

    res.status(201).json({ message: '콜렉션이 추가되었습니다.', collection: savedCollection });
  } catch (error) {
    res.status(500).json({ message: '콜렉션 추가 오류', error: error.message });
  }
};


// 레퍼런스 추가
export const createReference = asyncHandler(async (req, res) => {
  try {
    const { collectionName, title, keywords, memo, files } = req.body;

    // 필수 입력값 체크
    if (!collectionName) {
      return res.status(400).json({ message: "컬렉션을 선택해 주세요." });
    } else if (!title) {
      return res.status(400).json({ message: "제목을 입력해 주세요." });
    } else if (!files) {
      return res.status(400).json({ message: "첨부파일이 존재하지 않습니다." });
    }

    // 컬렉션 찾기
    const collection = await Collection.findOne({ collectionName });
    if (!collection) {
      return res.status(400).json({ message: `${collectionName} 이름을 갖는 컬렉션이 존재하지 않습니다.` });
    }

    const collectionId = collection._id;

    // 새로운 레퍼런스 생성
    const newReference = new Reference({
      title,
      collectionId,
      memo,
    });

    const saveReference = await newReference.save();

    // 첨부파일 처리
    let fileArray = [];
    let imageFile_nember = 0;
    const defaultImageFolder = `upload/images/${collectionName}_${title}`;
    const defaultImageNewName = `${collectionName}_${title}`;

    for (const file of files) {
      let { fileType } = file;

      if (fileType == "link") {  // link는 lists에 저장
        if (file.originalName.startsWith('http://') || file.originalName.startsWith('https://')) {
          const newList = new List({
            listUrl: file.originalName,
            referenceId: saveReference._id,
          });
          await newList.save();
        } else {
          return res.status(400).json({ message: "http:// 또는 https://로 시작하는 링크를 입력해 주세요." });
        }
      } else if (fileType == "image") { // images
        let imageFolder = defaultImageFolder;
        let imageNewName = defaultImageNewName;
        if (!fs.existsSync(imageFolder)) {
          fs.mkdirSync(imageFolder, { recursive: true });
        } else {
          imageFile_nember++;
          imageNewName = defaultImageNewName + imageFile_nember.toString();
          imageFolder = `${defaultImageFolder}_${imageFile_nember}`;
        }

        file.newName = imageNewName;
        file.filePath = imageFolder;
        fileArray.push(file);

        // 이미지 파일 저장
        file.imageList.forEach((imagefile, index) => {
          let newName = `${Date.now()}_${collectionName}_${title}_${imagefile}`;
          let imageFilePath = path.join(imageFolder, newName);
          fs.writeFileSync(imageFilePath, "");
        });
      } else { // pdf, file
        let folder = "upload/";
        if (fileType == "pdf") folder = "upload/pdfs/";
        if (fileType == "file") folder = "upload/files/";
        
        let newName = `${Date.now()}_${file.originalName}`;
        const filePath = path.join(folder, newName);
        fs.writeFileSync(filePath, "");
        file.newName = newName;
        file.filePath = filePath;
        fileArray.push(file);
      }
    }

    newReference.files = fileArray;
    const updatedReference = await newReference.save();

    // 키워드 처리
    let words = keywords.split(' ');
    if (words.length > 10) {
      words.length = 10;
    }

    for (let keywordName of words) {
      if (keywordName.length > 15) {
        keywordName = keywordName.slice(0, 15);
      }

      const keyword = await Keyword.findOne({ keywordName });
      if (!keyword) {
        const newKeyword = new Keyword({ keywordName });
        const saveKeyword = await newKeyword.save();
        const newRefkey = new Refkey({ referenceId: saveReference._id, keywordId: saveKeyword._id });
        await newRefkey.save();
      } else {
        const newRefkey = new Refkey({ referenceId: saveReference._id, keywordId: keyword._id });
        await newRefkey.save();
      }
    }

    res.status(201).json({ message: '레퍼런스 추가 성공', reference: newReference });
  } catch (error) {
    res.status(500).json({ message: '레퍼런스 추가 오류', error: error.message });
  }
});


// 레퍼런스 수정
export const updateReference = asyncHandler(async (req, res) => {
    try {
      const { referenceId, collectionName, title, keywords, memo, files } = req.body;
  
      // 필수 입력값 체크
      if (!referenceId) {
        return res.status(400).json({ message: "레퍼런스를 선택해 주세요." });
      }
      if (!collectionName) {
        return res.status(400).json({ message: "컬렉션을 선택해 주세요." });
      } else if (!title) {
        return res.status(400).json({ message: "제목을 입력해 주세요." });
      }
  
      // 레퍼런스 찾기
      const reference = await Reference.findById(referenceId);
      if (!reference) {
        return res.status(404).json({ message: "레퍼런스를 찾을 수 없습니다." });
      }
  
      // 컬렉션 찾기
      const collection = await Collection.findOne({ collectionName });
      if (!collection) {
        return res.status(400).json({ message: `${collectionName} 이름을 갖는 컬렉션이 존재하지 않습니다.` });
      }
  
      // 수정된 데이터로 레퍼런스 업데이트
      reference.title = title || reference.title;
      reference.memo = memo || reference.memo;
      reference.collectionId = collection._id;
  
      const updatedReference = await reference.save();
  
      // 파일 처리 (기존 파일은 삭제하고 새로운 파일 추가)
      let fileArray = [];
      let imageFile_nember = 0;
      const defaultImageFolder = `upload/images/${collectionName}_${title}`;
      const defaultImageNewName = `${collectionName}_${title}`;
  
      // 기존 파일 삭제 로직 (필요한 경우 추가)
  
      for (const file of files) {
        let { fileType } = file;
  
        if (fileType == "link") {  // link는 lists에 저장
          if (file.originalName.startsWith('http://') || file.originalName.startsWith('https://')) {
            const newList = new List({
              listUrl: file.originalName,
              referenceId: updatedReference._id,
            });
            await newList.save();
          } else {
            return res.status(400).json({ message: "http:// 또는 https://로 시작하는 링크를 입력해 주세요." });
          }
        } else if (fileType == "image") { // images
          let imageFolder = defaultImageFolder;
          let imageNewName = defaultImageNewName;
          if (!fs.existsSync(imageFolder)) {
            fs.mkdirSync(imageFolder, { recursive: true });
          } else {
            imageFile_nember++;
            imageNewName = defaultImageNewName + imageFile_nember.toString();
            imageFolder = `${defaultImageFolder}_${imageFile_nember}`;
          }
  
          file.newName = imageNewName;
          file.filePath = imageFolder;
          fileArray.push(file);
  
          // 이미지 파일 저장
          file.imageList.forEach((imagefile, index) => {
            let newName = `${Date.now()}_${collectionName}_${title}_${imagefile}`;
            let imageFilePath = path.join(imageFolder, newName);
            fs.writeFileSync(imageFilePath, "");
          });
        } else { // pdf, file
          let folder = "upload/";
          if (fileType == "pdf") folder = "upload/pdfs/";
          if (fileType == "file") folder = "upload/files/";
  
          let newName = `${Date.now()}_${file.originalName}`;
          const filePath = path.join(folder, newName);
          fs.writeFileSync(filePath, "");
          file.newName = newName;
          file.filePath = filePath;
          fileArray.push(file);
        }
      }
  
      updatedReference.files = fileArray;
      const finalUpdatedReference = await updatedReference.save();
  
      // 키워드 처리
      if (keywords) {
        let words = keywords.split(' ');
        if (words.length > 10) {
          words.length = 10;
        }
  
        // 기존 키워드 삭제 로직 (필요한 경우 추가)
  
        for (let keywordName of words) {
          if (keywordName.length > 15) {
            keywordName = keywordName.slice(0, 15);
          }
  
          const keyword = await Keyword.findOne({ keywordName });
          if (!keyword) {
            const newKeyword = new Keyword({ keywordName });
            const saveKeyword = await newKeyword.save();
            const newRefkey = new Refkey({ referenceId: updatedReference._id, keywordId: saveKeyword._id });
            await newRefkey.save();
          } else {
            const newRefkey = new Refkey({ referenceId: updatedReference._id, keywordId: keyword._id });
            await newRefkey.save();
          }
        }
      }
  
      res.status(200).json({ message: '레퍼런스 수정 성공', reference: finalUpdatedReference });
    } catch (error) {
      res.status(500).json({ message: '레퍼런스 수정 오류', error: error.message });
    }
  });
  

  // 레퍼런스 상세보기
export const getReferenceDetails = asyncHandler(async (req, res) => {
    try {
      const { referenceId } = req.params;
  
      // 필수 입력값 체크
      if (!referenceId) {
        return res.status(400).json({ message: "레퍼런스를 선택해 주세요." });
      }
  
      // 레퍼런스 찾기
      const reference = await Reference.findById(referenceId).populate('collectionId').exec();
      if (!reference) {
        return res.status(404).json({ message: "레퍼런스를 찾을 수 없습니다." });
      }
  
      // 파일 정보와 관련된 키워드 조회
      const fileDetails = reference.files.map(file => ({
        fileType: file.fileType,
        originalName: file.originalName,
        newName: file.newName,
        filePath: file.filePath,
        imageList: file.imageList,
      }));
  
      // 키워드 정보 조회
      const refkeys = await Refkey.find({ referenceId }).populate('keywordId').exec();
      const keywords = refkeys.map(refkey => refkey.keywordId.keywordName);
  
      res.status(200).json({
        message: '레퍼런스 상세보기 성공',
        reference: {
          title: reference.title,
          memo: reference.memo,
          collectionName: reference.collectionId.collectionName,
          files: fileDetails,
          keywords,
        },
      });
    } catch (error) {
      res.status(500).json({ message: '레퍼런스 상세보기 오류', error: error.message });
    }
  });
  