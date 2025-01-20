import multer from 'multer';
import path from 'path';

// 이미지 저장
const storage = multer.diskStorage({
    destination: function(req, file, cb){
      const { collectionName, title } = req.body;
      let folder = `upload/images/${collectionName}_${title}`;
      let imageFile_nember = 0;

      if (fileType == "image") {
        if(!fs.existsSync(filder)){
          folder = `upload/images/${collectionName}_${title}`;
        }
        else { // 사진 묶음이 2개 이상이라, collection_title 폴더가 이미 존재하는 경우 
          imageFile_nember++;
          folder = folder + imageFile_nember.toString();
          // collection_title_1 과 같은 폴더 생성 
        }
        fs.mkdir(folder, { recursive: true }, (err) => {
          if (err){ console.log("컨트롤러 이미지 저장에서 에러 발생")}
          cb(null, folder);
        });
      } else {
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