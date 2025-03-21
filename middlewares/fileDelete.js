import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3 URL에서 파일명을 추출하는 함수
export const extractFileNameFromS3Url = (fileUrl) => {
  try {
    if (!fileUrl) return null;
    
    // 파일 URL에서 마지막 '/' 뒤의 파일명만 추출
    const urlParts = fileUrl.split("/");
    return urlParts[urlParts.length - 1] || null;
  } catch (error) {
    console.error("S3 파일명 추출 오류:", error.message);
    return null;
  }
};

// S3 URL 기반으로 파일 삭제하는 함수
export const deleteFileByUrl = async (fileUrl) => {
  try {
    const fileName = extractFileNameFromS3Url(fileUrl);
    if (fileName) {
      await deleteFileFromS3(fileName);
      console.log(`파일 삭제 완료: ${fileName}`);
    } else {
      console.warn(`유효하지 않은 파일 URL: ${fileUrl}`);
    }
  } catch (error) {
    console.error(`S3 파일 삭제 실패 (${fileUrl}):`, error.message);
  }
};


export const deleteFileFromS3 = async (fileUrl) => {
    try {
      const bucketName = process.env.S3_BUCKET_NAME;
  
      // fileUrl이 S3 URL이면 Key만 추출
      let fileKey;
      if (fileUrl.includes("amazonaws.com")) {
        const urlParts = new URL(fileUrl);
        fileKey = urlParts.pathname.substring(1); // '/' 이후의 경로만 추출
      } else {
        fileKey = fileUrl; // URL이 아니라면 그대로 사용
      }
  
      const deleteParams = {
        Bucket: bucketName,
        Key: fileKey,
      };
  
      await s3.send(new DeleteObjectCommand(deleteParams));
      console.log(`S3 파일 삭제 완료: ${fileKey}`);
    } catch (error) {
      console.error(`S3 파일 삭제 실패: ${fileUrl}`, error.message);
    }
  };
