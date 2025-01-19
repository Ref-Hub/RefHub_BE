import multer from 'multer';
import path from 'path';

// 이미지 저장
const storage = multer.diskStorage({
    destination: function(req, file, cb){
      const dataType = req.body.dataType;
      let originalName = req.body.originalName;
      let folder = "upload/";
      if (dataType == "image") folder = "upload/images/";
      if (dataType == "pdf") folder = "upload/pdfs/";
      if (dataType == "link"){
        folder = "upload/links/";
        originalName = originalName.split("//")[1].split("/")[0];
      }
      if (dataType == "file") folder = "upload/files/";
      cb(null, folder ); // 파일 저장 위치 
    },
    newName: function(req, file, cb){
      cb(null, Date.now() + "_" + file.originalname);
      // 파일 이름 : 현재 시간 + 원본 파일 이름 
    }
  });

const upload = multer({ storage: storage });
export { upload };