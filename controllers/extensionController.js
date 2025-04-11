import Collection from "../models/Collection.js";
import Reference from "../models/Reference.js";
import Extension from "../models/Extension.js";

import { formatFileSize } from "../middlewares/fileUtil.js";
import { convertPdfToImage, savePreviewImage } from "../middlewares/convert.js";
import { uploadFileToS3 } from "../middlewares/fileUpload.js";

export const authCheckEx = async (req, res, next) => {
  try {
    return res.status(200).json({
      message: "로그인 상태 정상",
    });
  } catch (err) {
    console.error("Error during authCheck:", err.message);
    return res
      .status(500)
      .json({ error: "로그인 상태 확인 중 오류가 발생했습니다." });
  }
};

export const addReferenceEx = async (req, res, next) => {
  const userId = req.user.id;
  const { link, fileType } = req.body;
  const file = req.file;

  // 링크가 존재할 때 링크 형식 확인
  if (link && !link.startsWith("http://") && !link.startsWith("https://")) {
    return res
      .status(400)
      .json({ error: "링크는 http:// 또는 https://로 시작해야 합니다." });
  }
  // pdf 존재할 떄 파일 형식 확인
  else if (file && fileType == "pdf" && file.mimetype != "application/pdf") {
    return res.status(400).json({ error: "PDF 파일만 업로드 가능합니다." });
  }

  try {
    // 익스텐션 컬렉션 있는지 찾기
    let exCollection = await Extension.findOne({
      userId: userId,
    }).lean();

    // 컬렉션 있는지 찾기
    const collectionExists = await Collection.exists({
      _id: exCollection?.collectionId,
    });

    // 익스텐션에는 남아있는데 실제로는 없으면 익스텐션 삭제
    if (!collectionExists) {
      await Extension.deleteOne({ userId: userId });
      exCollection = null;
    }

    // 컬렉션 없으면 생성
    if (!exCollection) {
      const collection = await Collection.create({
        title: "구글 확장 프로그램",
        createdBy: userId,
      });
      exCollection = await Extension.create({
        userId: userId,
        collectionId: collection._id,
      });
    }

    const files = [];
    switch (fileType) {
      case "link":
        files.push({
          type: "link",
          path: link,
          size: 0,
          previewURL: link,
        });
        break;

      case "image":
        const [uploadedImage, uploadedImagePreview] = await Promise.all([
          uploadFileToS3(file), // 원본 사진 업로드
          savePreviewImage(file), // 프리뷰 업로드
        ]);
        const imagePath = uploadedImage.url; // 원본 사진 저장 경로
        const previewURL = uploadedImagePreview.url; // 프리뷰 저장 경로
        const filename = file.originalname;

        files.push({
          type: "image",
          path: imagePath,
          size: formatFileSize(file.size),
          images: imagePath,
          previewURLs: previewURL,
          filenames: filename,
        });
        break;

      case "pdf":
        const [uploadedFile, uploadedFilePreview] = await Promise.all([
          uploadFileToS3(file), // 원본 pdf 업로드
          convertPdfToImage(file), // 사진으로 변환 후 업로드
        ]);

        files.push({
          type: "pdf",
          path: uploadedFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedFilePreview.url,
          filename: file.originalname,
        });
        break;

      case "otherFile":
        const uploadedOtherFile = await uploadFileToS3(file);
        files.push({
          type: "file",
          path: uploadedOtherFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedOtherFile.url,
          filename: file.originalname,
        });
        break;

      default:
        return res.status(404).json({ error: "지원하는 형식이 아닙니다." });
    }

    // 컬렉션에 레퍼런스 저장
    const now = new Date()
      .toLocaleString("ko-KR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(/\. /g, ".")
      .replace(/\.$/, "")
      .replace(/(?<=\d)\.(?=\d{2}:)/, " ");

    const reference = new Reference({
      collectionId: exCollection.collectionId,
      title: now,
      files,
    });
    await reference.save();

    return res.status(201).json({
      message: "레퍼런스가 등록되었습니다.",
      reference,
    });
  } catch (err) {
    console.error("Error during reference creation:", err.message);
    return res.status(500).json({ error: "레퍼런스 생성에 실패하였습니다." });
  }
};
