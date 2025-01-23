import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 이미지 저장
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { collectionName, title } = req.body;
    let folder = `upload/images/${collectionName}_${title}`;
    let imageFile_nember = 0;

    if (file.mimetype.startsWith("image")) {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      } else {
        imageFile_nember++;
        folder = `${folder}_${imageFile_nember}`;
        fs.mkdirSync(folder, { recursive: true });
      }
      cb(null, folder);
    } else {
      let folder = "upload/";
      if (file.mimetype === "application/pdf") folder = "upload/pdfs/";
      if (file.mimetype.startsWith("application/")) folder = "upload/files/";
      cb(null, folder);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage: storage });
export { upload };
