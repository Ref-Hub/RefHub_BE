import { pdf } from "pdf-to-img";
import { GridFSBucket } from "mongodb";
import mongoose from "mongoose";
import multer from "multer";
import * as dotenv from "dotenv";

dotenv.config();

// MongoDB 연결
let bucket;

  mongoose.connection.once("open", () => {
    console.log("MongoDB 연결 성공");
    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: "imageUploads" });
    // 다른 bucket 사용

    console.log("GridFSBucket 초기화 성공:", bucket.s.options.bucketName);
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB 연결 실패:", err.message);
  });

  // Multer 설정 
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
  });
  
  const convertPdfToImage = (file) => {
    return new Promise(async (resolve, reject) => {
      console.log("PDF 프리뷰 생성 시작");
  
      try {
        const document = await pdf(file.buffer);
        const firstPage = await document.getPage(1);
  
        if (!firstPage) {
          return reject(new Error("PDF 변환 실패: 첫 번째 페이지 로드 실패"));
        }
  
        console.log("변환된 첫 번째 페이지 버퍼 크기:", firstPage.length);
  
        // GridFs에 저장
        const uploadStream = bucket.openUploadStream(
          file.originalname.replace(".pdf", ".png"),
          {
            contentType: "image/png",
            metadata: {
              originalFile: file.originalname,
              uploadedBy: "user",
            },
          }
        );
  
        uploadStream.end(firstPage);
  
        uploadStream.on("finish", () => {
          if (!uploadStream.id) {
            return reject(new Error("이미지 저장 실패: ID 생성 실패"));
          }
  
          console.log("이미지 저장 완료 ID:", uploadStream.id);
  
          // 결과 반환
          resolve({
            id: uploadStream.id,
            filename: file.originalname,
            contentType: "image/png",
          });
        });
  
        uploadStream.on("error", (err) => {
          console.error("GridFS 저장 실패:", err.message);
          reject(err);
        });
      } catch (err) {
        console.error("PDF 변환 실패:", err.message);
        reject(err);
      }
    });
  };
  

export { upload, convertPdfToImage };
