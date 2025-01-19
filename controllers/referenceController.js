import { Collection, Reference, Keyword, Refkey } from '../models/Reference.js';
import path from 'path';
import fs from 'fs';

// 레퍼런스 추가
export const createReference = async (req, res) => {
    try {
        const { collectionName, title, keywords, memo, datas } = req.body;

        // 400 형식 오류 
        if (!collectionName){
            return res.status(400).json({ message: "컬렉션을 선택해 주세요."})
        } else if (!title){
            return res.status(400).json({ message: "제목을 입력해 주세요."})
        } else if (!datas){
            return res.status(400).json({ message: "첨부파일이 존재하지 않습니다."})
        }

        // 첨부파일 저장 
        const fileList = [];
        for (const data of datas){
          let { dataType, originalName } = data;
          let folder = "upload/";
          if (dataType == "image") folder = "upload/images/";
          if (dataType == "pdf") folder = "upload/pdfs/";
          if (dataType == "link"){
            if (originalName.startsWith('http://') || originalName.startsWith('https://')){
              folder = "upload/links/";
              originalName = originalName.split("//")[1].split("/")[0];
            }
            else {
              return res.status(400).json({ message: "http:// 또는 https://로 시작하는 링크를 입력해 주세요."})
            }
          }
          if (dataType == "file") folder = "upload/files/";
          const filePath = path.join(folder, `${Date.now()}_${originalName}`);
          fs.writeFileSync(filePath, "");
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
          files: datas,
        });

        const saveReference = await newReference.save();

        // 키워드 저장 
        const words = keywords.split(' ');
        for ( const keywordName of words) {
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
