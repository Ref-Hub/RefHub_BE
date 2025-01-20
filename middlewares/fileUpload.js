import multer from 'multer';
import path from 'path';

// 이미지 저장
const storage = multer.diskStorage({
    destination: function(req, file, cb){
      const { collectionName, title } = req.body;
      let folder = "upload/";

      if (fileType == "image") {
        folder = `upload/images/${collectionName}_${title}`;
        fs.mkdir(folder, { recursive: true }, (err) => {
          // 새로운 폴더 생성, 폴더 이름 collectionName_title
          if (err){ console.log("미들웨어 이미지 저장에서 에러 발생")}
          cb(null, folder); // 
        });
        
      }
      else {
        if (fileType == "pdf") folder = "upload/pdfs/";
        if (fileType == "file") folder = "upload/files/";
        cb(null, folder ); // 파일 저장 위치 
      }
    },
    filename: (req, file, cb) => {
      cb(null, newName);
    }
  });

const upload = multer({ storage: storage });
export { upload };