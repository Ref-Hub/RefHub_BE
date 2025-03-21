import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { pipeline } from "stream";
import { promisify } from "util";

dotenv.config();
const pipelineAsync = promisify(pipeline);

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const downloadFileFromS3 = async (req, res) => {
  try {
    const fileUrl = req.query.fileUrl; // 요청된 S3 파일 URL
    if (!fileUrl) {
      return res.status(400).json({ error: "파일 URL이 필요합니다." });
    }

    // S3 키 추출 (URL에서 파일 이름 부분만 가져오기)
    const fileKey = decodeURIComponent(new URL(fileUrl).pathname.substring(1));
    console.log("S3에서 검색할 파일 키:", fileKey);

    // S3에서 파일 가져오기
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
    };
    const command = new GetObjectCommand(params);
    const file = await s3.send(command);

    // 파일명 인코딩 (RFC 5987 표준에 맞게 URL-safe 방식 적용)
    const encodedFileName = encodeURIComponent(fileKey).replace(/'/g, "%27");

    // 응답 헤더 설정
    res.setHeader("Content-Type", file.ContentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodedFileName}`
    );

    // 파일 스트림을 응답으로 전달
    await pipelineAsync(file.Body, res);
  } catch (error) {
    console.error("S3 파일 다운로드 실패:", error);
    res.status(500).json({ error: "S3에서 파일을 다운로드하는 중 오류가 발생했습니다." });
  }
};
