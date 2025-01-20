import { Collection, Reference, Keyword, Refkey, List } from '../models/Reference.js';
import path from 'path';
import fs from 'fs';

// 레퍼런스 추가
export const createReference = async (req, res) => {
    try {
        const { collectionName, title, keywords, memo, files } = req.body;

        // 400 형식 오류 
        if (!collectionName){
            return res.status(400).json({ message: "컬렉션을 선택해 주세요."})
        } else if (!title){
            return res.status(400).json({ message: "제목을 입력해 주세요."})
        } else if (!files){
            return res.status(400).json({ message: "첨부파일이 존재하지 않습니다."})
        }
        
        // 레퍼런스 저장 
        const collection = await Collection.findOne({ collectionName });
        if(!collection){
          return res.status(400).json({ message: `${collectionName} 이름을 갖는 컬렉션이 존재하지 않습니다.`});
        }

        const collectionId = collection._id;

        const newReference = new Reference({
          title,
          collectionId,
          memo,
        });

        const saveReference = await newReference.save();

        // 첨부파일 저장 
        let fileArray = [];
        let imageFile_nember = 0;
        const defaultImageFolder = `upload/images/${collectionName}_${title}`;
        const defaultImageNewName = `${collectionName}_${title}`;
        for (const file of files){
          let { fileType } = file;
          // link는 lists에 저장
          if (fileType == "link"){
            if (file.originalName.startsWith('http://') || file.originalName.startsWith('https://')){
              const newList = new List({
                listUrl: file.originalName,
                referenceId: saveReference._id,
              });
              const saveList = await newList.save();
            }
            else {
              return res.status(400).json({ message: "http:// 또는 https://로 시작하는 링크를 입력해 주세요."})
            }
          } else if (fileType == "image"){ // images
            // collectionName_title 폴더를 upload/images 안에 생성 
            let imageFolder = defaultImageFolder;
            let imageNewName = defaultImageNewName;
            if(!fs.existsSync(imageFolder)) {}
            else { // 사진 묶음이 2개 이상이라, collection_title 폴더가 이미 존재하는 경우 
              imageFile_nember++;
              imageNewName = defaultImageNewName + imageFile_nember.toString();
              imageFolder = `${defaultImageFolder}_${imageFile_nember}`;
            }
            file.newName = imageNewName;
            file.filePath = imageFolder;
            fileArray.push(file);

            // 폴더 생성 
            fs.mkdir(imageFolder, { recursive: true }, (err) => {
              if (err){ console.log("컨트롤러 이미지 저장에서 에러 발생")}
            });

            file.imageList.forEach(( imegefile, index) => {
              let newName = `${Date.now()}_${collectionName}_${title}_${imegefile}`;
              let imageFilePath = path.join(imageFolder, newName );
              fs.writeFileSync(imageFilePath, "");
              // 생성된 폴더 안에 image 저장, image 이름 : Date.Now()_collectionName_title_원본이름
            })

          } else { // pdf, file
            let folder = "upload/";
            if (fileType == "pdf") folder = "upload/pdfs/";
            if (fileType == "file") folder = "upload/files/";
            // upload/pdfs 또는 upload/files 안에 file 저장, 이름 : Date.Now()_원본이름
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

        // 키워드 저장 
        let words = keywords.split(' ');
        if (words.length > 10){
          words.length = 10;
        } // 키워드 최대 10개 
        for ( let keywordName of words) {
          if (keywordName.length > 15) {
            keywordName = keywordName.slice(0, 15);
          } // 키워드 최대 15글자
          try {
            const keyword = await Keyword.findOne({ keywordName });
            if(!keyword){
              const newKeyword = new Keyword({ keywordName });
              const saveKeyword = await newKeyword.save();
              const newRefkey = new Refkey({ referenceId: saveReference._id, keywordId: saveKeyword._id });
              await newRefkey.save();
            } else {
              const newRefkey = new Refkey({ referenceId: saveReference._id, keywordId: keyword._id });
              await newRefkey.save();
            }
          } catch (error) {
            console.log('keyword err');
          }
        }
 
        res.status(201).json({ message: '레퍼런스 추가 성공', reference: newReference });
      } catch (error) {
        res.status(500).json({ message: '레퍼런스 추가 오류',  error: error.message });
      }
}
