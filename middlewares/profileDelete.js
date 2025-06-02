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

// S3 URL에서 key 추출
export const extractKeyFromS3Url = (profileUrl) => {
    try{
        if (!profileUrl) return null;
        const url = new URL(profileUrl);

        // url에서 key 추출
        const key = decodeURIComponent(url.pathname.substring(1));
        return key
    } catch (err) {
        console.log("S3 프로필 이미지 key 추출 오류: ", err.message);
    }
}

export const deleteProfileImageByUrl = async (profileUrl) => {
    try{
        const key = extractKeyFromS3Url(profileUrl);
        if (key) {
            await deleteKeyFromS3(key);
            console.log(`프로필 이미지 삭제 완료: ${key}`);
        } else {
            console.warn(`유효하지 않은 프로필 URL: ${profileUrl}`);
        }
    } catch (err){
        console.log(`S3 프로필 삭제 실패 ${profileUrl}:`, err.message);
    }
}

export const deleteKeyFromS3 = async (key) => {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      });
  
      await s3.send(command);
      console.log(`S3 프로필 이미지 삭제 완료: ${key}`);
    } catch (error) {
      console.error(`S3 프로필 이미지 삭제 실패: ${error.message}`);
    }
  };