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
export const extractKeyFromS3Url = (previewurl) => {
    try{
        if (!previewurl) return null;
        const url = new URL(previewurl);

        // url에서 key 추출
        const key = decodeURIComponent(url.pathname.substring(1));
        return key
    } catch (err) {
        console.log("S3 프리뷰 key 추출 오류: ", err.message);
    }
}

export const deletePreviewByUrl = async (previewUrl) => {
    try{
        const key = extractKeyFromS3Url(previewUrl);
        if (key) {
            await deleteKeyFromS3(key);
            console.log(`프리뷰 삭제 완료: ${key}`);
        } else {
            console.warn(`유효하지 않은 프리뷰 URL: ${previewUrl}`);
        }
    } catch (err){
        console.log(`S3 프리뷰 삭제 실패 ${previewUrl}:`, err.message);
    }
}

export const deleteKeyFromS3 = async (key) => {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      });
  
      await s3.send(command);
      console.log(`S3 프리뷰 파일 삭제 완료: ${key}`);
    } catch (error) {
      console.error(`S3 프리뷰 파일 삭제 실패: ${error.message}`);
    }
  };