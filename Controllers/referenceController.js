import Reference from "../models/reference.js";
import Collection from "../models/Collection.js";
import { uploadFileToGridFS } from "../middlewares/fileUpload.js";
import { getFileUrl } from "../middlewares/fileUtil.js";
import mongoose from "mongoose";



// 레퍼런스 추가
export const addReference = async (req, res) => {
  try {
    const { collectionTitle, title, keywords, memo, links } = req.body;

    // 유저 인증 확인
    const userId = req.user.id;

    // Collection 확인
    const collection = await Collection.findOne({
      title: collectionTitle,
      createdBy: userId, // 유저가 생성한 콜렉션만
    });
    if (!collection) {
      return res
        .status(404)
        .json({ error: "해당 콜렉션을 찾을 수 없습니다." });
    }

    const files = [];
    let totalAttachments = 0; // 총 첨부 자료 개수

    // 링크 처리
    if (links) {
      const linkArray = Array.isArray(links) ? links : [links];
      for (const link of linkArray) {
        if (!link.startsWith("http://") && !link.startsWith("https://")) {
          return res.status(400).json({ error: "링크는 http:// 또는 https://로 시작해야 합니다." });
        }

        if (totalAttachments >= 5) {
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
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

    // 이미지 리스트 처리 (images1, images2, ..., images5)
    for (let i = 1; i <= 5; i++) {
      const key = `images${i}`;
      if (req.files[key]) {
        if (totalAttachments >= 5) {
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
        }

        const imagePaths = [];
        const previewURLs = [];
        let totalImageSize = 0;

        // 이미지 리스트 내 이미지 처리
        const images = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];
        for (const image of images) {
          const uploadedImage = await uploadFileToGridFS(image, "uploads");
          imagePaths.push(uploadedImage.id.toString());
          previewURLs.push(getFileUrl(uploadedImage.id.toString()));
          totalImageSize += image.size;
        }

        // 이미지 리스트를 하나의 첨부 자료로 처리
        files.push({
          type: "image",
          path: imagePaths.join(", "),
          size: totalImageSize,
          images: imagePaths,
          previewURLs: previewURLs,
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

        const fileExtension = file.originalname.split(".").pop().toLowerCase();
        if (fileExtension !== "pdf") {
          return res.status(400).json({ error: "PDF 파일만 업로드 가능합니다." });
        }

        const uploadedFile = await uploadFileToGridFS(file, "uploads");
        const URL = getFileUrl(uploadedFile.id.toString());
        files.push({
          type: "pdf",
          path: uploadedFile.id.toString(),
          size: file.size,
          previewURL: URL,
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

        const fileExtension = file.originalname.split(".").pop().toLowerCase();
        const allowedExtensions = ["jpg", "jpeg", "png", "pdf"];
        if (allowedExtensions.includes(fileExtension)) {
          return res
            .status(400)
            .json({ error: "이미지 및 PDF 파일은 기타 파일로 처리할 수 없습니다." });
        }

        const uploadedFile = await uploadFileToGridFS(file, "uploads");
        const URL = getFileUrl(uploadedFile.id.toString());
        files.push({
          type: "file",
          path: uploadedFile.id.toString(),
          size: file.size,
          previewURL: URL,
        });
        totalAttachments++;
      }
    }

    // Reference 생성
    const reference = new Reference({
      collectionId: collection._id,
      title,
      keywords: keywords ? keywords.split(" ").filter((kw) => kw.length <= 15) : [],
      memo,
      files,
    });

    await reference.save();

    res.status(201).json({ message: "레퍼런스가 등록되었습니다.", reference });
  } catch (err) {
    console.error("Error during reference creation:", err.message);
    res.status(500).json({ error: err.message });
  }
};




// 레퍼런스 수정
export const updateReference = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { collectionTitle, title, keywords, memo, links } = req.body;

    // 유저 인증 확인
    const userId = req.user.id;

    // 기존 레퍼런스 가져오기
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    // 레퍼런스를 저장할 컬렉션 확인 및 업데이트
    if (collectionTitle) {
      const newCollection = await Collection.findOne({
        title: collectionTitle,
        createdBy: req.user.id, // 해당 유저가 생성한 컬렉션이어야 함
      });

      if (!newCollection) {
        return res.status(404).json({ error: "해당 컬렉션을 찾을 수 없습니다." });
      }

      reference.collectionId = newCollection._id; // 새로운 컬렉션으로 업데이트
    }

    const db = mongoose.connection.db; // MongoDB 연결 객체
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });

    // 기존 첨부 자료 삭제
    for (const file of reference.files) {
      console.log("파일 데이터:", file); // 각 file 객체 출력
      if (file.type === "file" || file.type === "pdf") {
        try {
          // path 값을 콤마로 분리하여 각각의 ID 처리
          const objectIds = file.path.split(",").map((id) => id.trim()); // 콤마로 구분된 ID를 배열로 변환

          for (const id of objectIds) {
            if (mongoose.Types.ObjectId.isValid(id)) {
              // ID가 유효한 ObjectId인지 확인
              const objectId = new mongoose.Types.ObjectId(id);
              await bucket.delete(objectId); // GridFS에서 해당 ObjectId 삭제
              console.log(`기존 파일 삭제 완료: ${id}`);
            } else {
              console.warn(`유효하지 않은 ObjectId: ${id}`); // 유효하지 않은 ID 경고 출력
            }
          }
        } catch (err) {
          console.error(`파일 삭제 실패: ${file.path}`, err.message);
        }
      } else if (file.type === "image") {
        try {
          console.log("이미지 파일 ID 배열:", file.images);
          // file.images 배열을 순회하여 각각의 ID 처리
          for (const id of file.images) {
            if (mongoose.Types.ObjectId.isValid(id)) {
              // ID가 유효한 ObjectId인지 확인
              const objectId = new mongoose.Types.ObjectId(id);
              await bucket.delete(objectId); // GridFS에서 해당 ObjectId 삭제
              console.log(`기존 이미지 파일 삭제 완료: ${id}`);
            } else {
              console.warn(`유효하지 않은 이미지 ObjectId: ${id}`); // 유효하지 않은 ID 경고 출력
            }
          }
        } catch (err) {
          console.error(`이미지 파일 삭제 실패: ${file.images}`, err.message);
        }
      }
    }


    // 기존 첨부 자료 초기화
    const files = [];
    let totalAttachments = 0;

    // 링크 처리
    if (links) {
      const linkArray = Array.isArray(links) ? links : [links];
      for (const link of linkArray) {
        if (!link.startsWith("http://") && !link.startsWith("https://")) {
          return res.status(400).json({ error: "링크는 http:// 또는 https://로 시작해야 합니다." });
        }

        if (totalAttachments >= 5) {
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
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

    // 이미지 리스트 처리 (images1, images2, ..., images5)
    for (let i = 1; i <= 5; i++) {
      const key = `images${i}`;
      if (req.files[key]) {
        if (totalAttachments >= 5) {
          return res.status(400).json({ error: "첨부 자료는 최대 5개까지 가능합니다." });
        }

        const imagePaths = [];
        const previewURLs = [];
        let totalImageSize = 0;

        // 이미지 리스트 내 이미지 처리
        const images = Array.isArray(req.files[key]) ? req.files[key] : [req.files[key]];
        for (const image of images) {
          const uploadedImage = await uploadFileToGridFS(image, "uploads");
          imagePaths.push(uploadedImage.id.toString());
          previewURLs.push(getFileUrl(uploadedImage.id.toString()));
          totalImageSize += image.size;
        }

        // 이미지 리스트를 하나의 첨부 자료로 처리
        files.push({
          type: "image",
          path: imagePaths.join(", "),
          size: totalImageSize,
          images: imagePaths,
          previewURLs: previewURLs,
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

        const fileExtension = file.originalname.split(".").pop().toLowerCase();
        if (fileExtension !== "pdf") {
          return res.status(400).json({ error: "PDF 파일만 업로드 가능합니다." });
        }

        const uploadedFile = await uploadFileToGridFS(file, "uploads");
        const URL = getFileUrl(uploadedFile.id.toString());
        files.push({
          type: "pdf",
          path: uploadedFile.id.toString(),
          size: file.size,
          previewURL: URL,
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

        const fileExtension = file.originalname.split(".").pop().toLowerCase();
        const allowedExtensions = ["jpg", "jpeg", "png", "pdf"];
        if (allowedExtensions.includes(fileExtension)) {
          return res
            .status(400)
            .json({ error: "이미지 및 PDF 파일은 기타 파일로 처리할 수 없습니다." });
        }

        const uploadedFile = await uploadFileToGridFS(file, "uploads");
        const URL = getFileUrl(uploadedFile.id.toString());
        files.push({
          type: "file",
          path: uploadedFile.id.toString(),
          size: file.size,
          previewURL: URL,
        });
        totalAttachments++;
      }
    }

    // 레퍼런스 데이터 업데이트
    reference.title = title || reference.title;
    reference.keywords = keywords ? keywords.split(" ").filter((kw) => kw.length <= 15) : reference.keywords;
    reference.memo = memo || reference.memo;
    reference.files = files;

    await reference.save();

    res.status(200).json({ message: "레퍼런스가 수정되었습니다.", reference });
  } catch (err) {
    console.error("Error during reference update:", err.message);
    res.status(500).json({ error: err.message });
  }
};



// 레퍼런스 상세 기능
export const getReferenceDetail = async (req, res) => {
  try {
    const { referenceId } = req.params;

    // 레퍼런스 찾기
    const reference = await Reference.findById(referenceId).populate("collectionId", "title");
    if (!reference) {
      return res.status(404).json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    // 응답 데이터 구성
    const referenceDetail = {
      collectionTitle: reference.collectionId.title, // 컬렉션 이름
      referenceTitle: reference.title, // 레퍼런스 이름
      keywords: reference.keywords, // 키워드
      memo: reference.memo, // 메모
      attachments: reference.files.map((file) => ({
        type: file.type,
        path: file.path,
        size: file.size,
        images: file.images || null, // 이미지일 경우 이미지 리스트 포함
        previewURLs: file.previewURLs || null, // 이미지일 경우 프리뷰 URL 포함
        previewURL: file.previewURL || null, // PDF 또는 기타 파일일 경우 프리뷰 URL 포함
      })),
    };

    res.status(200).json({ message: "레퍼런스 상세 정보", referenceDetail });
  } catch (err) {
    console.error("Error fetching reference detail:", err.message);
    res.status(500).json({ error: "레퍼런스 상세 정보를 가져오는 중 오류가 발생했습니다." });
  }
};



// 레퍼런스 삭제 기능
export const deleteReference = async (req, res) => {
  try {
    const { referenceId } = req.params;

    // 레퍼런스 찾기
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    const db = mongoose.connection.db; // MongoDB 연결 객체
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });

    // 첨부 자료 삭제
    for (const file of reference.files) {
      console.log("파일 데이터:", file); // 각 file 객체 출력
      if (file.type === "file" || file.type === "pdf") {
        try {
          // path 값을 콤마로 분리하여 각각의 ID 처리
          const objectIds = file.path.split(",").map((id) => id.trim()); // 콤마로 구분된 ID를 배열로 변환

          for (const id of objectIds) {
            if (mongoose.Types.ObjectId.isValid(id)) {
              // ID가 유효한 ObjectId인지 확인
              const objectId = new mongoose.Types.ObjectId(id);
              await bucket.delete(objectId); // GridFS에서 해당 ObjectId 삭제
              console.log(`기존 파일 삭제 완료: ${id}`);
            } else {
              console.warn(`유효하지 않은 ObjectId: ${id}`); // 유효하지 않은 ID 경고 출력
            }
          }
        } catch (err) {
          console.error(`파일 삭제 실패: ${file.path}`, err.message);
        }
      } else if (file.type === "image") {
        try {
          console.log("이미지 파일 ID 배열:", file.images);
          // file.images 배열을 순회하여 각각의 ID 처리
          for (const id of file.images) {
            if (mongoose.Types.ObjectId.isValid(id)) {
              // ID가 유효한 ObjectId인지 확인
              const objectId = new mongoose.Types.ObjectId(id);
              await bucket.delete(objectId); // GridFS에서 해당 ObjectId 삭제
              console.log(`기존 이미지 파일 삭제 완료: ${id}`);
            } else {
              console.warn(`유효하지 않은 이미지 ObjectId: ${id}`); // 유효하지 않은 ID 경고 출력
            }
          }
        } catch (err) {
          console.error(`이미지 파일 삭제 실패: ${file.images}`, err.message);
        }
      }
    }

    // 레퍼런스 삭제
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
    page = 1,
    limit = 10,
    collection = "all",
    filterBy = "all",
    search = "",
    view = "card",
  } = req.query;

  const userId = req.user.id; // 인증된 유저 ID
  const collectionArray = Array.isArray(collection) ? collection : [collection];
  let sharedList = [];
  let referenceArray = [];
  let collectionSearch;
  let collectionSearchArray = [];

  try {
    // 전체 레퍼런스 조회 (특정 컬렉션 선택 X)
    if (collectionArray[0] === "all") {
      collectionSearch = {
        $or: [
          { createdBy: userId },
          { "sharedWith.userId": userId },
        ],
      };

      referenceArray = await Reference.find({});
      if (referenceArray.length === 0) {
        return res.status(201).json({
          message: "아직 추가한 레퍼런스가 없어요.\n레퍼런스를 추가해보세요!",
        });
      }
    } else {
      // 특정 컬렉션 조회 (collection 선택 O)
      for (const col of collectionArray) {
        const collection = await Collection.findOne({
          title: col,
          $or: [
            { createdBy: userId },
            { "sharedWith.userId": userId },
          ],
        });

        if (!collection) {
          continue; // 유저에게 해당 컬렉션 권한이 없으면 건너뜀
        }

        const colId = collection._id;
        if (collection.sharedWith.length === 0) {
          sharedList.push(colId);
        }

        collectionSearchArray.push({ collectionId: colId });
      }

      collectionSearch = {
        collectionId: {
          $in: collectionSearchArray.map((obj) => obj.collectionId),
        },
      };
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
    switch (filterBy) {
      case "title":
        filterSearch = { title: { $regex: `${search}`, $options: "i" } };
        break;
      case "keyword":
        filterSearch = {
          keywords: { $regex: `${search}`, $options: "i" },
        };
        break;
      case "all":
        filterSearch = {
          $or: [
            { title: { $regex: `${search}`, $options: "i" } },
            { keywords: { $regex: `${search}`, $options: "i" } },
          ],
        };
        break;
      default:
        filterSearch = {};
    }

    // 총 레퍼런스 개수 계산
    const totalItemCount = await Reference.countDocuments({
      ...collectionSearch,
      ...filterSearch,
    });

    if (totalItemCount === 0) {
      return res.status(201).json({
        message: "검색 결과가 없어요.\n다른 검색어로 시도해보세요!",
      });
    }

    // 페이지네이션 계산
    const totalPages = Math.ceil(totalItemCount / limit);
    const currentPage = Number(page) > totalPages ? totalPages : Number(page);
    const skip = (currentPage - 1) * limit;

    // 레퍼런스 조회
    const data = await Reference.find({
      ...collectionSearch,
      ...filterSearch,
    })
      .skip(skip)
      .limit(limit)
      .sort(sort);

    // 결과 데이터 변환
    let finalData;
    switch (view) {
      case "card":
        finalData = data.map((item) => ({
          ...item.toObject(),
          sharing: sharedList.includes(item.collectionId),
        }));
        break;
      case "list":
        finalData = data.map((item, index) => ({
          ...item.toObject(),
          number: skip + index + 1,
        }));
        break;
      default:
        finalData = data.map((item) => ({
          ...item.toObject(),
          sharing: sharedList.includes(item.collectionId),
        }));
        break;
    }

    res.status(201).json({
      currentPage,
      totalPages,
      totalItemCount,
      data: finalData,
    });
  } catch (error) {
    console.error("레퍼런스 조회 오류:", error.message);
    res
      .status(500)
      .json({ message: "레퍼런스 조회 중 오류가 발생했습니다.", error: error.message });
  }
};
