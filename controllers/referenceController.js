import Reference from "../models/Reference.js";
import Keyword from "../models/Keyword.js";
import Collection from "../models/Collection.js";
import CollectionShare from "../models/CollectionShare.js";
import CollectionFavorite from "../models/CollectionFavorite.js";
import { deleteFileByUrl } from "../middlewares/fileDelete.js";
import { deletePreviewByUrl } from "../middlewares/previewDelete.js";
import { formatFileSize } from "../middlewares/fileUtil.js";
import mongoose from "mongoose";
import ogs from "open-graph-scraper";
import { convertPdfToImage, savePreviewImage } from "../middlewares/convert.js";
import { uploadFileToS3 } from "../middlewares/fileUpload.js";
import { hasEditorAccess, hasViewerAccess } from "../middlewares/permission.js";

// 레퍼런스 추가 (추가 가능한 collection 리스트 조회)
export const getColList = async (req, res) => {
  const userId = req.user.id;

  console.log(userId);
  try {
    let collectionSearch = { createdBy: userId };
    let editorCollSearch = { userId: userId, role: "editor" };
    let favoriteSearch = { userId: userId, isFavorite: true };

    let createCol = await Collection.distinct("_id", collectionSearch);
    let editorCol = await CollectionShare.distinct(
      "collectionId",
      editorCollSearch
    );
    let favoriteCol = await CollectionFavorite.distinct(
      "collectionId",
      favoriteSearch
    );
    let allCol = [...new Set([...createCol, ...editorCol])];
    let notFavoriteCol = allCol.filter((id) => !favoriteCol.includes(id));

    let FavoriteTitle = await Collection.find(
      { _id: { $in: favoriteCol } },
      { _id: 1, title: 1 }
    ).lean();
    FavoriteTitle.sort((a, b) => {
      return (
        a.title - b.title ||
        a.title.toString().localeCompare(b.title.toString())
      );
    });

    let notFavoriteTitle = await Collection.find(
      { _id: { $in: notFavoriteCol } },
      { _id: 1, title: 1 }
    ).lean();
    notFavoriteTitle.sort((a, b) => {
      return (
        a.title - b.title ||
        a.title.toString().localeCompare(b.title.toString())
      );
    });

    let col = [...new Set([...FavoriteTitle, ...notFavoriteTitle])];

    if (col.length == 0) {
      res.status(404).json({ message: "컬렉션이 존재하지 않습니다." });
    } else {
      res.status(200).json({ col, message: "컬렉션이 조회되었습니다." });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "레퍼런스 추가 모드에서 오류가 발생하였습니다." });
  }
};

// 레퍼런스 추가
export const addReference = async (req, res) => {
  try {
    const { collectionId, title, keywords, memo, links } = req.body;

    // 유저 인증 확인
    const userId = req.user.id;

    // Collection 확인
    const collection = await Collection.findOne({
      _id: collectionId, // title에서 id로 컬렉션 찾기 변경
    });

    if (!collection) {
      return res.status(404).json({ error: "해당 컬렉션을 찾을 수 없습니다." });
    }

    // 권한 확인 (생성자 또는 editor)
    const hasAccess = await hasEditorAccess(userId, collectionId);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "레퍼런스를 추가할 권한이 없습니다." });
    }

    // 키워드 처리: 기존 키워드는 그대로 사용, 새로운 키워드는 추가
    let keywordIds = [];
    if (keywords) {
      const keywordArray = Array.isArray(keywords)
        ? keywords
        : keywords.split(" ");
      for (const keyword of keywordArray) {
        if (keyword.length > 15) continue; // 15자 초과 키워드 무시

        let existingKeyword = await Keyword.findOne({ keywordName: keyword });
        if (!existingKeyword) {
          existingKeyword = await Keyword.create({ keywordName: keyword });
        }
        keywordIds.push(existingKeyword._id);
      }
    }

    const files = [];
    let totalAttachments = 0; // 총 첨부 자료 개수

    // 링크 처리
    if (links) {
      const linkArray = Array.isArray(links) ? links : [links];

      for (const link of linkArray) {
        if (totalAttachments >= 5) {
          return res
            .status(400)
            .json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
        }

        if (!link.startsWith("http://") && !link.startsWith("https://")) {
          return res
            .status(400)
            .json({ error: "링크는 http:// 또는 https://로 시작해야 합니다." });
        }

        files.push({
          type: "link",
          path: link,
          size: 0,
          previewURL: link,
        });

        totalAttachments++;
      }
    }

    // 이미지 리스트 처리 (최대 5개까지만 허용, 하나의 첨부 자료로 취급)
    for (let i = 1; i <= 5; i++) {
      const key = `images${i}`;
      if (req.files[key]) {
        if (totalAttachments >= 5) {
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
        }

        const imagePaths = [];
        const previewURLs = [];
        const filenames = [];

        // 이미지 리스트 내부 최대 5개 제한
        const images = Array.isArray(req.files[key])
          ? req.files[key].slice(0, 5) // 최대 5개까지만 허용
          : [req.files[key]];

        for (const image of images) {
          // 파일명 정규화 및 인코딩
          const encodedName = normalizeAndEncodeFileName(image.originalname);

          // 정규화된 파일명으로 업로드
          const uploadedImage = await uploadFileToS3({
            ...image,
            originalname: encodedName
          });
          const uploadedImagePreview = await savePreviewImage({
            ...image,
            originalname: encodedName
          });

          imagePaths.push(uploadedImage.url);
          previewURLs.push(uploadedImagePreview.url);
          filenames.push(encodedName); // 인코딩된 파일명 저장
        }

        files.push({
          type: "image",
          path: imagePaths.join(", "),
          size: formatFileSize(images.reduce((total, img) => total + img.size, 0)),
          images: imagePaths,
          previewURLs: previewURLs,
          filenames: filenames,
        });

        totalAttachments++;
      }
    }

    // PDF 처리
    if (req.files.files) {
      for (const file of req.files.files) {
        if (totalAttachments >= 5) {
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
        }

        if (file.originalname.split(".").pop().toLowerCase() !== "pdf") {
          return res.status(400).json({ error: "PDF 파일만 업로드 가능합니다." });
        }

        // 파일명 정규화 및 인코딩
        const encodedName = normalizeAndEncodeFileName(file.originalname);

        // 정규화된 파일명으로 업로드
        const uploadedFile = await uploadFileToS3({
          ...file,
          originalname: encodedName
        });
        const uploadedFilePreview = await convertPdfToImage({
          ...file,
          originalname: encodedName
        });

        files.push({
          type: "pdf",
          path: uploadedFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedFilePreview.url,
          filename: encodedName, // 인코딩된 파일명 저장
        });

        totalAttachments++;
      }
    }

    // 기타 파일 처리
    if (req.files.otherFiles) {
      for (const file of req.files.otherFiles) {
        if (totalAttachments >= 5) {
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
        }

        // 파일명 정규화 및 인코딩
        const encodedName = normalizeAndEncodeFileName(file.originalname);

        // 정규화된 파일명으로 업로드
        const uploadedFile = await uploadFileToS3({
          ...file,
          originalname: encodedName
        });

        files.push({
          type: "file",
          path: uploadedFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedFile.url,
          filename: encodedName, // 인코딩된 파일명 저장
        });

        totalAttachments++;
      }
    }

    // Reference 생성
    const reference = new Reference({
      collectionId: collection._id,
      title,
      keywords: keywordIds,
      memo,
      files,
    });

    await reference.save();

    // 키워드 이름 조회
    const populatedKeywords = await Keyword.find({
      _id: { $in: reference.keywords },
    }).lean();
    const keywordNames = populatedKeywords.map((k) => k.keywordName);

    res.status(201).json({
      message: "레퍼런스가 등록되었습니다.",
      reference: {
        ...reference.toObject(),
        collectionId: reference.collectionId,
        collectionTitle: collection.title,
        keywords: keywordNames,
      },
    });
  } catch (err) {
    console.error("Error during reference creation:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 파일명 정규화 및 인코딩 유틸 함수
const normalizeAndEncodeFileName = (fileName) => {
  try {
    const normalized = fileName.normalize("NFC");
    return encodeURIComponent(normalized);
  } catch (error) {
    console.error("파일명 인코딩 오류:", error.message);
    return fileName;
  }
};

export const updateReference = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const {
      collectionId,
      title,
      keywords,
      memo,
      links,
      existingFiles,
      existingKeywords,
    } = req.body;
    const userId = req.user.id;

    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    const hasAccess = await hasEditorAccess(userId, reference.collectionId);
    if (!hasAccess) {
      return res.status(403).json({ error: "레퍼런스를 수정할 권한이 없습니다." });
    }

    // 기존 파일 유지 목록
    let keepFilePaths = [];
    try {
      keepFilePaths = existingFiles ? JSON.parse(existingFiles) : reference.files.map(f => f.path);
    } catch {
      return res.status(400).json({ error: "기존 파일 정보 형식이 잘못되었습니다." });
    }

    // 유지할 파일 필터링
    const filesToKeep = reference.files.filter((file) => {
      if (typeof file.path !== 'string') return false;
      return keepFilePaths.some((keepPath) => {
        if (file.type === 'image' && file.path.includes(',')) {
          return file.path.split(',').map(p => p.trim()).includes(keepPath);
        }
        return file.path === keepPath;
      });
    });

    // 삭제 대상 파일
    const filesToDelete = reference.files.filter(
      (file) => !filesToKeep.find(f => f._id.toString() === file._id.toString())
    );

    for (const file of filesToDelete) {
      if (file.type === "pdf") {
        await deletePreviewByUrl(file.previewURL);
      } else if (file.type === "image") {
        for (const previewURL of file.previewURLs || []) {
          await deletePreviewByUrl(previewURL);
        }
      }
      if (file.type !== "link" && file.path) {
        const paths = file.path.includes(",") ? file.path.split(",").map(p => p.trim()) : [file.path];
        for (const path of paths) {
          await deleteFileByUrl(path);
        }
      }
    }

    // 기존 키워드 유지
    let updatedKeywordIds = [];
    try {
      const keepKeywordIds = existingKeywords ? JSON.parse(existingKeywords) : reference.keywords;
      updatedKeywordIds = reference.keywords.filter((k) =>
        keepKeywordIds.includes(k.toString())
      );
    } catch {
      updatedKeywordIds = reference.keywords;
    }

    // 새 키워드 처리
    if (keywords) {
      const keywordArray = Array.isArray(keywords) ? keywords : keywords.split(" ");
      for (const word of keywordArray) {
        if (word.length > 15) continue;
        let kw = await Keyword.findOne({ keywordName: word });
        if (!kw) kw = await Keyword.create({ keywordName: word });
        if (!updatedKeywordIds.some((id) => id.toString() === kw._id.toString())) {
          updatedKeywordIds.push(kw._id);
        }
      }
    }

    const newFiles = [];
    let totalAttachments = filesToKeep.length;

    // 링크 처리
    if (links) {
      const linkArray = Array.isArray(links) ? links : [links];
      for (const link of linkArray) {
        if (totalAttachments >= 5) break;
        newFiles.push({
          type: "link",
          path: link,
          size: 0,
          previewURL: link,
        });
        totalAttachments++;
      }
    }

    // 이미지 처리
    for (let i = 1; i <= 5; i++) {
      const key = `images${i}`;
      if (req.files?.[key]) {
        if (totalAttachments >= 5) break;
        const imagePaths = [];
        const previewURLs = [];
        const filenames = [];
        const images = Array.isArray(req.files[key]) ? req.files[key].slice(0, 5) : [req.files[key]];
        for (const image of images) {
          const encodedName = normalizeAndEncodeFileName(image.originalname);
          const uploaded = await uploadFileToS3({ ...image, originalname: encodedName });
          const preview = await savePreviewImage({ ...image, originalname: encodedName });
          imagePaths.push(uploaded.url);
          previewURLs.push(preview.url);
          filenames.push(encodedName);
        }
        newFiles.push({
          type: "image",
          path: imagePaths.join(", "),
          size: formatFileSize(images.reduce((sum, img) => sum + img.size, 0)),
          images: imagePaths,
          previewURLs,
          filenames,
        });
        totalAttachments++;
      }
    }

    // PDF 처리
    if (req.files?.files) {
      const pdfs = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
      for (const file of pdfs) {
        if (totalAttachments >= 5) break;
        const encodedName = normalizeAndEncodeFileName(file.originalname);
        const uploaded = await uploadFileToS3({ ...file, originalname: encodedName });
        const preview = await convertPdfToImage({ ...file, originalname: encodedName });
        newFiles.push({
          type: "pdf",
          path: uploaded.url,
          size: formatFileSize(file.size),
          previewURL: preview.url,
          filename: encodedName,
        });
        totalAttachments++;
      }
    }

    // 기타 파일 처리
    if (req.files?.otherFiles) {
      const others = Array.isArray(req.files.otherFiles) ? req.files.otherFiles : [req.files.otherFiles];
      for (const file of others) {
        if (totalAttachments >= 5) break;
        const encodedName = normalizeAndEncodeFileName(file.originalname);
        const uploaded = await uploadFileToS3({ ...file, originalname: encodedName });
        newFiles.push({
          type: "file",
          path: uploaded.url,
          size: formatFileSize(file.size),
          previewURL: uploaded.url,
          filename: encodedName,
        });
        totalAttachments++;
      }
    }

    // 변경 반영
    if (collectionId && collectionId !== reference.collectionId.toString()) {
      reference.collectionId = new mongoose.Types.ObjectId(collectionId);
    }
    reference.title = title || reference.title;
    reference.memo = memo || reference.memo;
    reference.keywords = updatedKeywordIds;
    reference.files = [...filesToKeep, ...newFiles];

    await reference.save();

    const populatedKeywords = await Keyword.find({ _id: { $in: reference.keywords } }).lean();
    const keywordNames = populatedKeywords.map((k) => k.keywordName);

    res.status(200).json({
      message: "레퍼런스가 수정되었습니다.",
      reference: {
        ...reference.toObject(),
        keywords: keywordNames,
        collectionId: reference.collectionId,
      },
    });
  } catch (err) {
    console.error("Error during reference update:", err.message);
    res.status(500).json({ error: "레퍼런스 수정 중 오류가 발생했습니다." });
  }
};


// 레퍼런스 상세 기능
export const getReferenceDetail = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const userId = req.user.id;

    // 레퍼런스 찾기
    const reference = await Reference.findById(referenceId)
      .populate("collectionId", "title")
      .populate("keywords", "keywordName") // 키워드 정보 가져오기
      .lean();
    if (!reference) {
      return res
        .status(404)
        .json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    // 최초 생성자, editor, viewer 모두 접근 가능
    const hasAccess = await hasViewerAccess(userId, reference.collectionId._id);

    // 한국 표준 시간 변환 함수
    const toKSTString = (date) => {
      return new Date(date.getTime() + 9 * 60 * 60 * 1000) // UTC → KST
        .toISOString()
        .replace("T", " ")
        .substring(0, 19); // 보기 좋은 문자열 형태로 자르기
    };

    // 응답 데이터 구성
    const referenceDetail = {
      collectionTitle: reference.collectionId.title, // 컬렉션 이름
      collectionId: reference.collectionId._id, // 컬렉션 ID
      referenceTitle: reference.title, // 레퍼런스 이름
      keywords: reference.keywords.map((k) => k.keywordName), // 키워드
      memo: reference.memo, // 메모
      attachments: reference.files.map((file) => ({
        type: file.type,
        path: file.path,
        size: file.size,
        images: file.images || null, // 이미지일 경우 이미지 리스트 포함
        previewURLs: file.previewURLs || null, // 이미지일 경우 프리뷰 URL 포함
        previewURL: file.previewURL || null, // PDF 또는 기타 파일일 경우 프리뷰 URL 포함
        filenames: file.filenames || null, // 이미지리스트 원본 파일명 포함
        filename: file.filename || null, // PDF, 기타파일 원본 파일 이름 포함
      })),
      createdAt: toKSTString(reference.createdAt),
      updatedAt: reference.updatedAt && toKSTString(reference.updatedAt),
      version: reference.__v,
    };

    res.status(200).json({ message: "레퍼런스 상세 정보", referenceDetail });
  } catch (err) {
    console.error("Error fetching reference detail:", err.message);
    res
      .status(500)
      .json({ error: "레퍼런스 상세 정보를 가져오는 중 오류가 발생했습니다." });
  }
};

// 레퍼런스 삭제 기능
export const deleteReference = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const userId = req.user.id;

    // Reference 찾기
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res
        .status(404)
        .json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    // 권한 확인 (생성자 또는 editor)
    const hasAccess = await hasEditorAccess(userId, reference.collectionId);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "레퍼런스를 삭제할 권한이 없습니다." });
    }

    // 키워드 사용 여부 확인 후 삭제
    for (const keywordId of reference.keywords) {
      const keywordUsed = await Reference.findOne({
        _id: { $ne: reference._id },
        keywords: keywordId,
      });
      if (!keywordUsed) {
        await Keyword.findByIdAndDelete(keywordId);
      }
    }

    // S3에서 파일 삭제
    for (const file of reference.files) {
      if (file.type === "pdf") {
        // file이 pdf인 경우 pdf preview image 삭제
        deletePreviewByUrl(file.previewURL);
      } else if (file.type === "image") {
        for (const previewURL of file.previewURLs) {
          await deletePreviewByUrl(previewURL);
        }
      }
      if (file.type !== "link" && file.path) {
        if (typeof file.path === "string") {
          // 이미지 리스트 처리: 쉼표(,)가 포함된 경우 개별 URL로 분리하여 삭제
          const filePaths = file.path.includes(",")
            ? file.path.split(",").map((path) => path.trim())
            : [file.path];

          for (const filePath of filePaths) {
            await deleteFileByUrl(filePath);
          }
        } else {
          await deleteFileByUrl(file.path);
        }
      }
    }

    // Reference 삭제
    await Reference.findByIdAndDelete(referenceId);
    res.status(200).json({ message: "레퍼런스가 성공적으로 삭제되었습니다." });
  } catch (err) {
    console.error("Error deleting reference:", err.message);
    res
      .status(500)
      .json({ error: "레퍼런스를 삭제하는 중 오류가 발생했습니다." });
  }
};

// 레퍼런스 홈
export const getReference = async (req, res) => {
  const {
    sortBy = "latest",
    collection = "all",
    filterBy = "all",
    search = "",
    view = "card",
    mode = "home",
  } = req.query;
  const userId = req.user.id; // 인증된 유저 ID

  const collectionArray = Array.isArray(collection) ? collection : [collection];
  let referenceArray = []; // 검색 결과로 얻은 reference
  let creatorColSearch = { createdBy: userId }; // creator
  let viewerCollSearch = { userId: userId, role: "viewer" }; // viewer
  let editorCollSearch = { userId: userId, role: "editor" }; // editor

  try {
    let creatorList = await Collection.distinct("_id", creatorColSearch); // user가 생성한 coll Id, creator
    let creatAndShareList = await CollectionShare.distinct("collectionId", {
      collectionId: { $in: creatorList },
    }); // user가 생성한 collection 중 공유되고 있는 coll Id
    let viewerList = await CollectionShare.distinct(
      "collectionId",
      viewerCollSearch
    ); // viewer로 참여하는 coll Id
    let editorList = await CollectionShare.distinct(
      "collectionId",
      editorCollSearch
    ); // editor로 참여하는 coll Id
    let collectionIdList = [...creatorList, ...viewerList, ...editorList]; // user가 참여한 모든 coll Id
    let sharedList = [...creatAndShareList, ...viewerList, ...editorList]; // 공유되고 있는 모든 col Id (생성, 참여)

    // 전체 레퍼런스 조회 (특정 컬렉션 선택 X)
    if (collectionArray[0] === "all") {
      referenceArray = await Reference.find({
        collectionId: { $in: collectionIdList },
      });
      if (referenceArray.length === 0) {
        return res.status(200).json({
          message: "아직 추가한 레퍼런스가 없어요.\n레퍼런스를 추가해보세요!",
        });
      }
    } else {
      // 특정 컬렉션 조회 (collection 선택 O)
      let searchCollList = await Collection.distinct("_id", {
        title: { $in: collectionArray },
      });
      collectionIdList = collectionIdList.filter((item) =>
        searchCollList.map((id) => id.toString()).includes(item.toString())
      );
      creatorList = creatorList.filter((item) =>
        searchCollList.map((id) => id.toString()).includes(item.toString())
      );
      viewerList = viewerList.filter((item) =>
        searchCollList.map((id) => id.toString()).includes(item.toString())
      );
      editorList = editorList.filter((item) =>
        searchCollList.map((id) => id.toString()).includes(item.toString())
      );
      sharedList = sharedList.filter((item) =>
        searchCollList.map((id) => id.toString()).includes(item.toString())
      );
    }

    // 정렬 기준 설정
    let sort;
    switch (sortBy) {
      case "latest":
        sort = { createdAt: -1 };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
      case "sortAsc":
        sort = { title: 1 };
        break;
      case "sortDesc":
        sort = { title: -1 };
        break;
      default:
        sort = { createdAt: -1 };
        break;
    }

    // 필터링 조건 설정
    let filterSearch;
    let keywordSearch;
    let keywordIds;
    switch (filterBy) {
      case "title":
        filterSearch = { title: { $regex: `${search}`, $options: "i" } };
        break;
      case "keyword":
        keywordSearch = { keywordName: { $regex: `${search}`, $options: "i" } };
        keywordIds = await Keyword.distinct("_id", keywordSearch);
        console.log("keywordIds: ", keywordIds);
        filterSearch = { keywords: { $in: keywordIds } };
        break;
      case "all":
        keywordSearch = { keywordName: { $regex: `${search}`, $options: "i" } };
        keywordIds = await Keyword.distinct("_id", keywordSearch);
        console.log("keywordIds: ", keywordIds);
        filterSearch = {
          $or: [
            { title: { $regex: `${search}`, $options: "i" } },
            { keywords: { $in: keywordIds } },
          ],
        };
        break;
      default:
        filterSearch = {};
    }

    // 총 레퍼런스 개수 계산
    const totalItemCount = await Reference.countDocuments({
      ...filterSearch,
      collectionId: { $in: collectionIdList },
    });

    if (totalItemCount === 0) {
      return res.status(200).json({
        message: "검색 결과가 없어요.\n다른 검색어로 시도해보세요!",
      });
    } else {
      // 레퍼런스 조회
      let data = await Reference.find({
        ...filterSearch,
        collectionId: { $in: collectionIdList },
      }).sort(sort);

      // 결과 데이터 변환
      let finalData = await Promise.all(
        data.map(async (item, index) => {
          const { memo, files, keywords, ...obj } = item.toObject();
          let previewData = [];
          let keywordList = [];
          for (const keywordId of keywords) {
            const keyword = await Keyword.findById(keywordId);
            keywordList.push(keyword.keywordName);
          }
          let URLs = files.flatMap((file) => {
            if (file.type === "image") {
              //const imagePath = file.path.split(",");
              //return imagePath.map(url => ({ type: file.type, url }));
              return file.previewURLs.map((url) => ({ type: file.type, url }));
            } else if (file.type === "link") {
              return { type: file.type, url: file.previewURL };
            } else if (file.type === "pdf") {
              return { type: file.type, url: file.previewURL };
            } else {
              return [];
            }
          });
          for (const file of URLs) {
            if (file.type === "link") {
              try {
                const url = file.url;
                const { result } = await ogs({ url });
                const ogImageUrl = result?.ogImage?.[0]?.url || null;
                previewData.push(ogImageUrl);
              } catch (error) {
                console.error(`OGS error for ${file.url}:`, error);
                previewData.push(null);
              }
            } else if (file.type === "pdf") {
              previewData.push(file.url);
            } else if (file.type === "image") {
              previewData.push(file.url);
            } else {
              previewData.push(null);
            }
          }
          previewData = previewData.filter((item) => item !== null).slice(0, 4);
          return {
            ...obj,
            number: index + 1,
            keywords: keywordList,
            shared: sharedList
              .map((id) => id.toString())
              .includes(item.collectionId.toString()),
            creator: creatorList
              .map((id) => id.toString())
              .includes(item.collectionId.toString()),
            viewer: viewerList
              .map((id) => id.toString())
              .includes(item.collectionId.toString()),
            editor: editorList
              .map((id) => id.toString())
              .includes(item.collectionId.toString()),
            previewData: previewData,
          };
        })
      );

      switch (view) {
        case "card":
          finalData = finalData.map(({ number, ...rest }) => rest);
          break;
        case "list":
          finalData = finalData.map(({ previewURLs, ...rest }) => rest);
          break;
        default:
          finalData = finalData.map(({ number, ...rest }) => rest);
          break;
      }

      switch (mode) {
        case "home":
          res.status(200).json({
            totalItemCount,
            data: finalData,
          });
          break;
        case "delete":
          res.status(200).json({
            message: "삭제 모드로 전환되었습니다.",
            totalItemCount,
            data: finalData,
          });
          break;
        case "move":
          res.status(200).json({
            message: "컬렉션 이동 모드로 전환되었습니다.",
            totalItemCount,
            data: finalData,
          });
          break;
        default:
          res.status(200).json({
            totalItemCount,
            data: finalData,
          });
      }
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "레퍼런스 조회 중 오류가 발생했습니다." });
  }
};

async function getOGImage(url) {
  try {
    const { result } = await ogs({ url });
    return result.ogImage[0]?.url;
  } catch (err) {
    console.error(`OG Image fetch error (${url}:)`, err.message);
    return null;
  }
}

// 레퍼런스 이동 모드
export const moveReferences = async (req, res) => {
  try {
    let { referenceIds, newCollection } = req.body;
    let userId = req.user.id;

    let collection = await Collection.findOne({
      title: newCollection,
      createdBy: userId,
    }); // 직접 생성한 컬렉션으로 이동하는 경우

    if (!collection) {
      // 직접 생성한 컬렉션이 존재하지 않는 경우
      collection = await Collection.find({
        title: newCollection,
      });
      let collectionIds;
      if (!collection) {
        res.status(404).json({ message: "컬렉션이 존재하지 않습니다." });
      } else {
        // 공유받은 컬렉션이 존재하는지 확인
        collectionIds = collection.map((col) => col._id);
        const isCollectionShared = await CollectionShare.findOne({
          collectionId: { $in: collectionIds },
          userId: userId,
          role: "editor",
        });
        const newCollectionId = isCollectionShared.collectionId;
        if (!isCollectionShared) {
          // 공유받은 컬렉션도 존재하지 않음
          res
            .status(404)
            .json({ message: "권한을 가진 컬렉션이 존재하지 않습니다." });
        } else {
          // 공유받은 컬렉션이 존재함
          await Reference.updateMany(
            { _id: { $in: referenceIds } },
            { $set: { collectionId: newCollectionId } }
          );
          res.status(200).json({ message: `레퍼런스를 이동하였습니다.` });
        }
      }
    } else {
      const newCollectionId = collection._id;
      await Reference.updateMany(
        { _id: { $in: referenceIds } },
        { $set: { collectionId: newCollectionId } }
      );
      res.status(200).json({ message: `레퍼런스를 이동하였습니다.` });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "레퍼런스 이동 모드에서 오류가 발생하였습니다." });
  }
};

// 레퍼런스 삭제 모드
export const deleteReferences = async (req, res) => {
  try {
    const { referenceIds } = req.body;

    for (const id of referenceIds) {
      if (mongoose.Types.ObjectId.isValid(id) == false) {
        return res
          .status(400)
          .json({ message: "레퍼런스의 Id 형식이 올바르지 않습니다." });
      }
    }

    // 레퍼런스 찾기
    const references = await Reference.find({ _id: { $in: referenceIds } });
    if (references.length !== referenceIds.length) {
      return res
        .status(404)
        .json({ message: "해당 레퍼런스를 찾을 수 없습니다." });
    } else {
      for (const ref of references) {
        // 키워드 삭제
        for (const keywordId of ref.keywords) {
          const keywordUsed = await Reference.findOne({
            _id: { $ne: ref._id },
            keywords: keywordId,
          });
          if (!keywordUsed) {
            await Keyword.findByIdAndDelete(keywordId);
          }
        }

        // S3에서 파일 삭제
        for (const file of ref.files) {
          if (file.type === "pdf") {
            // file이 pdf인 경우 pdf preview image 삭제
            deletePreviewByUrl(file.previewURL);
          } else if (file.type === "image") {
            for (const previewURL of file.previewURLs) {
              await deletePreviewByUrl(previewURL);
            }
          }
          if (file.type !== "link" && file.path) {
            if (typeof file.path === "string") {
              // 이미지 리스트 처리: 쉼표(,)가 포함된 경우 개별 URL로 분리하여 삭제
              const filePaths = file.path.includes(",")
                ? file.path.split(",").map((path) => path.trim())
                : [file.path];

              for (const filePath of filePaths) {
                await deleteFileByUrl(filePath);
              }
            } else {
              await deleteFileByUrl(file.path);
            }
          }
        }
        // Reference 삭제
        await Reference.findByIdAndDelete(ref._id);
      }
      res
        .status(200)
        .json({ message: "레퍼런스가 성공적으로 삭제되었습니다." });
    }
  } catch (error) {
    console.log("레퍼런스 삭제 모드 오류:", error.message);
    res
      .status(500)
      .json({ message: "레퍼런스 삭제 모드에서 오류가 발생하였습니다." });
  }
};

/**
 * 파일 이름을 일관되게 정규화하고 인코딩하는 함수
 * @param {string} fileName - 원본 파일명
 * @returns {string} - 정규화 및 인코딩된 파일명
 */
const normalizeAndEncodeFileName = (fileName) => {
  try {
    // 한글 정규화 처리 (NFC 방식으로 통일)
    const normalized = fileName.normalize("NFC");

    // URL 인코딩 처리
    return encodeURIComponent(normalized);
  } catch (error) {
    console.error("파일명 인코딩 오류:", error.message);
    // 오류 발생 시 원본 반환
    return fileName;
  }
};
