import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

const downloadFile = async (req, res) => {
  const { id } = req.params;

  try {
    const db = mongoose.connection.db;
    //const bucket = new GridFSBucket(db, { bucketName: "uploads" });

    // ObjectId 유효성 검사
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid file ID" });
    }

    const objectId = new mongoose.Types.ObjectId(id);

    // 파일 존재 여부 확인
    // uploads에 존재하는 경우
    let fileExists = await db.collection("uploads.files").findOne({ _id: objectId });
    let bucketName = "uploads";

    if (!fileExists) {
      // imageUploads에 존재하는 경우 (pdf 프리뷰)
      fileExists = await db.collection("imageUploads.files").findOne({ _id: objectId });
      bucketName = "imageUploads";

      if (!fileExists) {
        return res.status(404).json({ message: "File not found" });
      }
    }

    const bucket = new GridFSBucket(db, { bucketName });
    // 파일 다운로드
    const downloadStream = bucket.openDownloadStream(objectId);

    res.set({
      "Content-Type": fileExists.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileExists.filename}"`,
    });

    // 파일 다운로드 로그에 파일 이름 추가
    console.log(`파일 다운로드 시작: ${fileExists.filename}`);

    downloadStream.pipe(res);

    downloadStream.on("error", (err) => {
      console.error("파일 다운로드 오류:", err.message);
      res.status(500).send("파일 다운로드 실패");
    });

    downloadStream.on("end", () => {
      console.log(`파일 다운로드 완료: ${fileExists.filename}`);
    });
  } catch (err) {
    console.error("오류 발생:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export default downloadFile;