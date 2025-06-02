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
    limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const isValid = allowedTypes.test(file.mimetype);
    if (isValid) {
      cb(null, true); // 업로드 허용
    } else {
      cb(new Error("JPG, PNG 형식의 파일만 첨부 가능합니다."), false);
    }
  },
});

export const saveProfileImage = async (req, file) => {
  try {
    const userId = req.user.id;
    const fileName = `profileImage/${randomUUID()}-${userId}.png`; // UUID로 파일명 중복 방지
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3.send(new PutObjectCommand(uploadParams));
    return {
      url: `${process.env.S3_BASE_URL}${fileName}`,
      fileName,
    };
  } catch (error) {
    console.error("profile image s3에 업로드 실패:", error.message);
    throw new Error("프로필 이미지 업로드 중 오류가 발생했습니다.");
  }
}