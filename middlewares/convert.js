import { pdf } from "pdf-to-img";
import multer from "multer";
import * as dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

dotenv.config();

  // AWS S3 클라이언트 설정
  const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // Multer 설정 
  const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
  });

export const convertPdfToImage = async (file) => {
  try {
    // 프리뷰 이미지 생성
    console.log("PDF 프리뷰 생성 시작");
    const document = await pdf(file.buffer);
    const firstPage = await document.getPage(1);

    if(!firstPage){
      throw new Error('PDF 변환 실패: 첫 번째 페이지 로드 실패');
    }

    const fileName = `${randomUUID()}-${file.originalname}-img`; // UUID로 파일명 중복 방지
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: firstPage,
      ContentType: "image/png",
    };

    await s3.send(new PutObjectCommand(uploadParams));
    return {
      url: `${process.env.S3_BASE_URL}${fileName}`,
      fileName,
    };
  } catch (error) {
    console.error("S3 pdf preview 업로드 실패:", error.message);
    throw new Error("pdf preview image 업로드 중 오류가 발생했습니다.");
  }
};
