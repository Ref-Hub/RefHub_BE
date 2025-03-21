import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 파일 URL 가져오기
export const getFileUrl = (fileName) => {
  return `${process.env.S3_BASE_URL}${fileName}`;
};

// 바이트(Byte)를 KB, MB, GB로 변환하는 함수
export const formatFileSize = (sizeInBytes) => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`; // B
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`; // KB
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`; // MB
  } else {
    return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`; // GB
  }
};
