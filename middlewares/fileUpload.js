import multer from "multer";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

dotenv.config();

// AWS S3 클라이언트 설정 (v3)
const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// multer 설정 (파일 메모리 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
}).fields([
  { name: "files", maxCount: 5 },
  { name: "images1" },
  { name: "images2" },
  { name: "images3" },
  { name: "images4" },
  { name: "images5" },
  { name: "otherFiles", maxCount: 5 },
]);

// S3에 파일 업로드 함수
export const uploadFileToS3 = async (file, fileType) => {
  try {
    // 일관된 인코딩 적용 - 한글 파일명 정규화 후 인코딩
    const normalizedName = file.originalname.normalize("NFC");
    const encodedFileName = encodeURIComponent(normalizedName);
    const fileName = `${randomUUID()}-${file.originalname}`; // UUID로 파일명 중복 방지

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        "original-filename": encodedFileName, // 메타데이터에 원본 파일명 저장
      }
    };

    await s3.send(new PutObjectCommand(uploadParams));
    return {
      url: `${process.env.S3_BASE_URL}${fileName}`,
      fileName: encodedFileName, // 인코딩된 파일명 반환
    };
  } catch (error) {
    console.error("S3 파일 업로드 실패:", error.message);
    throw new Error("파일 업로드 중 오류가 발생했습니다.");
  }
};

export { upload };
