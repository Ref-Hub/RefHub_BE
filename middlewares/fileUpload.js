  import multer from "multer";
  import mongoose from "mongoose";
  import { GridFSBucket } from "mongodb";
  import * as dotenv from "dotenv";

  dotenv.config();

  // MongoDB 연결
  let bucket;

  mongoose.connection.once("open", () => {
    console.log("MongoDB 연결 성공");

    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: "uploads" });

    console.log("GridFSBucket 초기화 성공:", bucket.s.options.bucketName);
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB 연결 실패:", err.message);
  });


  // Multer 메모리 스토리지 설정
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
  }).fields([
    { name: "files", maxCount: 5 }, // PDF 파일
    { name: "images1" }, // 이미지 파일1
    { name: "images2" }, // 이미지 파일2
    { name: "images3" }, // 이미지 파일3
    { name: "images4" }, // 이미지 파일4
    { name: "images5" }, // 이미지 파일5
    { name: "otherFiles", maxCount: 5 }, // 기타 파일
  ]);
  

  // 파일 업로드 함수
  const uploadFileToGridFS = async (file, bucketName = "uploads") => {
    return new Promise((resolve, reject) => {
      if (!bucket) {
        console.error("GridFS bucket이 초기화되지 않았습니다.");
        return reject(new Error("GridFS bucket is not initialized"));
      }

      console.log("파일 업로드 시작:", file.originalname);

      const uploadStream = bucket.openUploadStream(file.originalname, {
        contentType: file.mimetype,
        metadata: { uploadedBy: "user" },
      });

      uploadStream.write(file.buffer); // 스트림에 데이터 쓰기
      uploadStream.end(); // 스트림 종료

      uploadStream.on("finish", (fileData) => {
        console.log("업로드 스트림 완료 이벤트 발생:", fileData);
        if (!fileData || !fileData._id) {
          console.error("GridFS 파일 업로드 실패: fileData 또는 _id 없음");
          return reject(new Error("File upload failed. No _id returned."));
        }
        resolve({
          id: fileData._id,
          filename: fileData.filename,
          contentType: fileData.contentType,
        });
      });

      uploadStream.on("error", (err) => {
        console.error("GridFS 업로드 스트림 오류:", err.message);
        reject(err);
      });
    });
  };


  export { upload, uploadFileToGridFS };
