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
      { _id: { $in: favoriteCol }},
      { _id: 1, title: 1}
    ).lean();
    FavoriteTitle.sort((a, b) => {
      return a.title - b.title || a.title.toString().localeCompare(b.title.toString());
    });

    let notFavoriteTitle = await Collection.find(
      { _id: { $in: notFavoriteCol }},
      { _id: 1, title: 1}
    ).lean();
    notFavoriteTitle.sort((a, b) => {
      return a.title - b.title || a.title.toString().localeCompare(b.title.toString());
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
      title: collectionId, // title에서 id로 컬렉션 찾기 변경
      createdBy: userId,
    });

    if (!collection) {
      return res.status(404).json({ error: "해당 콜렉션을 찾을 수 없습니다." });
    }

    // 권한 확인 (생성자 또는 editor)
    const hasAccess = await hasEditorAccess(userId, collectionId);
    if (!hasAccess) {
      return res.status(403).json({ error: "레퍼런스를 추가할 권한이 없습니다." });
    }

    // 키워드 처리: 기존 키워드는 그대로 사용, 새로운 키워드는 추가
    let keywordIds = [];
    if (keywords) {
      const keywordArray = Array.isArray(keywords) ? keywords : keywords.split(" ");
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
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
        }

        if (!link.startsWith("http://") && !link.startsWith("https://")) {
          return res.status(400).json({ error: "링크는 http:// 또는 https://로 시작해야 합니다." });
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
          const uploadedImage = await uploadFileToS3(image); // 원본 사진 업로드 
          const uploadedImagePreview = await savePreviewImage(image); // 프리뷰 업로드 
          imagePaths.push(uploadedImage.url); // 원본 사진 저장 경로 
          previewURLs.push(uploadedImagePreview.url); // 프리뷰 저장 경로 
          filenames.push(image.originalname);
        }

        files.push({
          type: "image",
          path: imagePaths.join(", "),
          size: formatFileSize(images.reduce((total, img) => total + img.size, 0)),
          images: imagePaths,
          previewURLs: previewURLs,
          filenames: filenames,
        });

        totalAttachments++; // 이미지 리스트 하나가 첨부 자료 1개로 취급됨
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

        const uploadedFile = await uploadFileToS3(file);
        const uploadedFilePreview = await convertPdfToImage(file);
        files.push({
          type: "pdf",
          path: uploadedFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedFilePreview.url,
          filename: file.originalname,
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

        const uploadedFile = await uploadFileToS3(file);
        files.push({
          type: "file",
          path: uploadedFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedFile.url,
          filename: file.originalname,
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
    const populatedKeywords = await Keyword.find({ _id: { $in: reference.keywords } }).lean();
    const keywordNames = populatedKeywords.map(k => k.keywordName);

    res.status(201).json({ message: "레퍼런스가 등록되었습니다.", reference: {
      ...reference.toObject(),
      collectionId: reference.collectionId,
      collectionTitle: collection.title,
      keywords: keywordNames,
    } });
  } catch (err) {
    console.error("Error during reference creation:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// 레퍼런스 수정
export const updateReference = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { collectionTitle, title, keywords, memo, links, existingFiles, existingKeywords } = req.body;
    const userId = req.user.id;

    // 기존 Reference 가져오기
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    // 권한 확인 (생성자 또는 editor)
    const hasAccess = await hasEditorAccess(userId, reference.collectionId);
    if (!hasAccess) {
      return res.status(403).json({ error: "레퍼런스를 수정할 권한이 없습니다." });
    }

    // 클라이언트에서 유지할 기존 파일 정보 파싱
    const keepFiles = existingFiles ? JSON.parse(existingFiles) : [];

    // 유지할 기존 파일 필터링
    const filesToKeep = reference.files.filter(file => keepFiles.includes(file.path));

    // 삭제할 파일 목록 추출 (유지되지 않는 기존 파일)
    const filesToDelete = reference.files.filter(file => !keepFiles.includes(file.path));

    // 기존 파일 삭제 (레퍼런스 삭제 방식과 동일하게 적용)
    for (const file of filesToDelete) {
      if (file.type === "pdf") {
        await deletePreviewByUrl(file.previewURL);
      } else if (file.type === "image") {
        for (const previewURL of file.previewURLs){
          await deletePreviewByUrl(previewURL);
        }
      }
      if (file.type !== "link" && file.path) {
        if (typeof file.path === "string") {
          // 이미지 리스트 처리 (쉼표로 구분된 여러 개의 URL)
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

    // 기존 키워드 유지 & 삭제할 키워드 식별
    const keepKeywordIds = existingKeywords ? JSON.parse(existingKeywords) : [];
    let updatedKeywordIds = reference.keywords.filter(k => keepKeywordIds.includes(k.toString()));

    // 새로운 키워드 추가 (ObjectId 변환)
    if (keywords) {
      const keywordArray = Array.isArray(keywords) ? keywords : keywords.split(" ");
      for (const keyword of keywordArray) {
        if (keyword.length > 15) continue;

        let existingKeyword = await Keyword.findOne({ keywordName: keyword });
        if (!existingKeyword) {
          existingKeyword = await Keyword.create({ keywordName: keyword });
        }

        const keywordId = existingKeyword._id.toString();
        if (!updatedKeywordIds.includes(keywordId)) {
          updatedKeywordIds.push(new mongoose.Types.ObjectId(keywordId));
        }
      }
    }

    // 새로운 파일 저장할 배열
    const newFiles = [];
    let totalAttachments = filesToKeep.length; // 기존 유지 파일 개수 포함

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

    // 이미지 리스트 처리
    for (let i = 1; i <= 5; i++) {
      const key = `images${i}`;
      if (req.files[key]) {
        if (totalAttachments >= 5) break;

        const imagePaths = [];
        const filenames = [];

        const images = Array.isArray(req.files[key]) ? req.files[key].slice(0, 5) : [req.files[key]];
        for (const image of images) {
          const uploadedImage = await uploadFileToS3(image); // 원본 사진 업로드 
          const uploadedImagePreview = await savePreviewImage(image); // 프리뷰 업로드 
          imagePaths.push(uploadedImage.url); // 원본 사진 저장 경로 
          previewURLs.push(uploadedImagePreview.url); // 프리뷰 저장 경로 
          filenames.push(image.originalname);
        }

        newFiles.push({
          type: "image",
          path: imagePaths.join(", "),
          size: formatFileSize(images.reduce((total, img) => total + img.size, 0)),
          images: imagePaths,
          filenames: filenames,
        });

        totalAttachments++;
      }
    }

    // PDF 처리
    if (req.files.files) {
      for (const file of req.files.files) {
        if (totalAttachments >= 5) break;
        const uploadedFile = await uploadFileToS3(file);
        const uploadedFilePreview = await convertPdfToImage(file);
        newFiles.push({
          type: "pdf",
          path: uploadedFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedFilePreview.url,
          filename: file.originalname,
        });
        totalAttachments++;
      }
    }

    // 기타 파일 처리
    if (req.files.otherFiles) {
      for (const file of req.files.otherFiles) {
        if (totalAttachments >= 5) break;
        const uploadedFile = await uploadFileToS3(file);
        newFiles.push({
          type: "file",
          path: uploadedFile.url,
          size: formatFileSize(file.size),
          previewURL: uploadedFile.url,
          filename: file.originalname,
        });
        totalAttachments++;
      }
    }

    // 기존 파일 + 새로운 파일 병합
    reference.title = title || reference.title;
    reference.keywords = updatedKeywordIds;
    reference.memo = memo || reference.memo;
    reference.files = [...filesToKeep, ...newFiles];

    await reference.save();

    // 키워드 이름 조회
    const populatedKeywords = await Keyword.find({ _id: { $in: reference.keywords } }).lean();
    const keywordNames = populatedKeywords.map(k => k.keywordName);
    
    res.status(200).json({ message: "레퍼런스가 수정되었습니다.", reference: {
      ...reference.toObject(),
      keywords: keywordNames,
    } });

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

    // 응답 데이터 구성
    const referenceDetail = {
      collectionTitle: reference.collectionId.title, // 컬렉션 이름
      referenceTitle: reference.title, // 레퍼런스 이름
      keywords: reference.keywords.map(k => k.keywordName), // 키워드
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
      return res.status(404).json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    // 권한 확인 (생성자 또는 editor)
    const hasAccess = await hasEditorAccess(userId, reference.collectionId);
    if (!hasAccess) {
      return res.status(403).json({ error: "레퍼런스를 삭제할 권한이 없습니다." });
    }
    
    // 키워드 사용 여부 확인 후 삭제
        for (const keywordId of reference.keywords) {
          const keywordUsed = await Reference.findOne({
            _id: { $ne: reference._id },
            keywords: keywordId
          });
          if (!keywordUsed) {
            await Keyword.findByIdAndDelete(keywordId);
          }
        }
    
    // S3에서 파일 삭제
    for (const file of reference.files) {
      if(file.type === "pdf"){ // file이 pdf인 경우 pdf preview image 삭제 
        deletePreviewByUrl(file.previewURL);
      } else if (file.type === "image") {
        for (const previewURL of file.previewURLs){
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
    res.status(500).json({ error: "레퍼런스를 삭제하는 중 오류가 발생했습니다." });
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
  let creatorColSearch = { createdBy: userId}; // creator
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
    let sharedList = [...creatAndShareList, ...viewerList, ...editorList] // 공유되고 있는 모든 col Id (생성, 참여)

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
        searchCollList.map((id) => id.toString()).includes(item.toString()))
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
        keywordSearch = { keywordName: { $regex: `{search}`, $options: "i"}};
        keywordIds = await Keyword.find( "_id", keywordSearch );
        filterSearch = { keywords: { $in: keywordIds } }
        break;
      case "all":
        keywordSearch = { keywordName: { $regex: `${search}`, $options: "i" } };
        keywordIds = await Keyword.distinct("_id", keywordSearch);
        filterSearch = {
          $or: [
            { title: { $regex: `${search}`, $options: "i" } },
            { keywords: {$in: keywordIds} } ,
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
        data.map( async (item, index) => {
        const { memo, files, ...obj } = item.toObject();
        let previewData = [];
        let URLs = files.flatMap(file => {
          if (file.type === "image"){
            //const imagePath = file.path.split(",");
            //return imagePath.map(url => ({ type: file.type, url }));
            return file.previewURLs.map(url => ({ type: file.type, url }));
          } else if (file.type === "link"){
            return { type: file.type, url: file.previewURL }
          } else if (file.type === "pdf"){
            return { type: file.type, url: file.previewURL }
          } else{
            return [];
          }
        })
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
        previewData = previewData.filter(item => item !== null).slice(0, 4);
          return {
            ...obj,
            number: index + 1,
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

    if (!collection) { // 직접 생성한 컬렉션이 존재하지 않는 경우 
      collection = await Collection.find({
        title: newCollection
      })
      let collectionIds;
      if (!collection ){ 
        res.status(404).json({ message: "컬렉션이 존재하지 않습니다." });
      }
      else { // 공유받은 컬렉션이 존재하는지 확인 
        collectionIds = collection.map(col => col._id);
        const isCollectionShared = await CollectionShare.findOne({
          collectionId: { $in: collectionIds },
          userId: userId,
          role: "editor"
        }) 
        const newCollectionId = isCollectionShared.collectionId;
        if (!isCollectionShared) { // 공유받은 컬렉션도 존재하지 않음 
          res.status(404).json({ message: "권한을 가진 컬렉션이 존재하지 않습니다." });
        } else { // 공유받은 컬렉션이 존재함 
          await Reference.updateMany(
            { _id: { $in: referenceIds } },
            { $set: { collectionId: newCollectionId } }
          );
          res.status(200).json({ message: `레퍼런스를 이동하였습니다.` });
        }
      }
    } else {
      const newCollectionId = collection._id
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
            keywords: keywordId
          });
          if (!keywordUsed) {
            await Keyword.findByIdAndDelete(keywordId);
          }
        }

        // S3에서 파일 삭제
        for (const file of ref.files) {
          if(file.type === "pdf"){ // file이 pdf인 경우 pdf preview image 삭제 
            deletePreviewByUrl(file.previewURL);
          } else if (file.type === "image") {
            for (const previewURL of file.previewURLs){
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
      res.status(200).json({ message: "레퍼런스가 성공적으로 삭제되었습니다." });
    }
  } catch (error) {
    console.log("레퍼런스 삭제 모드 오류:", error.message);
    res
      .status(500)
      .json({ message: "레퍼런스 삭제 모드에서 오류가 발생하였습니다." });
  }
};
