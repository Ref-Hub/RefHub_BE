import Reference from "../models/reference.js";
import Collection from "../models/collection.js";
import { uploadFileToGridFS } from "../middlewares/fileUpload.js";
import mongoose from "mongoose";


//레퍼런스 추가
export const addReference = async (req, res) => {
  try {
    const { collectionTitle, title, keywords, memo, links } = req.body;

    // Collection 확인
    const collection = await Collection.findOne({ title: collectionTitle });
    if (!collection) {
      return res.status(404).json({ error: "해당 콜렉션이 존재하지 않습니다." });
    }

    const files = [];
    let totalAttachments = 0; // 총 첨부 자료 개수

    // 링크 처리
    if (links) {
      const linkArray = Array.isArray(links) ? links : [links]; // 단일 문자열일 경우 배열로 변환
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
          size: 0, // 링크는 크기가 없으므로 0
        });
        totalAttachments++;
      }
    }

    // 이미지 리스트 처리
    if (req.files.images) {
      if (req.files.images.length > 5) {
        return res.status(400).json({ error: "이미지 리스트는 최대 5개까지 가능합니다." });
      }

      const imagePaths = [];
      for (const image of req.files.images) {
        const uploadedImage = await uploadFileToGridFS(image, "uploads");
        imagePaths.push(uploadedImage.id.toString());
      }

      files.push({
        type: "image",
        path: imagePaths.join(", "),
        size: req.files.images.reduce((acc, img) => acc + img.size, 0),
        images: imagePaths,
      });
      totalAttachments++;
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
        files.push({
          type: "pdf",
          path: uploadedFile.id.toString(),
          size: file.size,
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
        files.push({
          type: "file",
          path: uploadedFile.id.toString(),
          size: file.size,
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
      files, // 파일, 링크, 이미지 정보 포함
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
    const { title, keywords, memo, links } = req.body;

    // 기존 레퍼런스 가져오기
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: "해당 레퍼런스를 찾을 수 없습니다." });
    }

    const db = mongoose.connection.db; // MongoDB 연결 객체
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });

    // 기존 첨부 자료 삭제
    for (const file of reference.files) {
      if (file.type === "file" || file.type === "pdf" || file.type === "image") {
        try {
          const objectId = new mongoose.Types.ObjectId(file.path);
          await bucket.delete(objectId); // GridFS에서 파일 삭제
          console.log(`기존 파일 삭제 완료: ${file.path}`);
        } catch (err) {
          console.error(`파일 삭제 실패: ${file.path}`, err.message);
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
        });
        totalAttachments++;
      }
    }

    // 이미지 리스트 처리
    if (req.files.images) {
      if (req.files.images.length > 5) {
        return res.status(400).json({ error: "이미지 리스트는 최대 5개까지 가능합니다." });
      }

      const imagePaths = [];
      for (const image of req.files.images) {
        const uploadedImage = await uploadFileToGridFS(image, "uploads");
        imagePaths.push(uploadedImage.id.toString());
      }

      files.push({
        type: "image",
        path: imagePaths.join(", "),
        size: req.files.images.reduce((acc, img) => acc + img.size, 0),
        images: imagePaths,
      });
      totalAttachments++;
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
        files.push({
          type: "pdf",
          path: uploadedFile.id.toString(),
          size: file.size,
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
        files.push({
          type: "file",
          path: uploadedFile.id.toString(),
          size: file.size,
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
      if (file.type === "file" || file.type === "pdf" || file.type === "image") {
        try {
          const objectId = new mongoose.Types.ObjectId(file.path);
          await bucket.delete(objectId); // GridFS에서 파일 삭제
          console.log(`기존 파일 삭제 완료: ${file.path}`);
        } catch (err) {
          console.error(`파일 삭제 실패: ${file.path}`, err.message);
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
  const { sortBy = 'latest', page = 1, limit = 10, collection = 'all', filterBy = 'all', search = "", view = 'card' } = req.query;
  const collectionArray = Array.isArray(collection) ? collection : [collection];
  let sharedList=[];
  let referenceArray = [];
  let collectionSearch;
  let collectionSearchArray = [];
  try {
    // 전체 레퍼런스 조회 (collection 선택 x)
    if (collectionArray[0] == 'all'){
      collectionSearch = {};
      // 레퍼런스가 존재하지 않는 경우
      referenceArray = await Reference.find({});
      if(referenceArray.length==0){
        res.status(201).json({ message: "아직 추가한 레퍼런스가 없어요.\n레퍼런스를 추가해보세요!"});
      }
    }
    // 특정 collection 조회 (collection 선택 o)
    else {
      for( const col of collectionArray ){
        const col = (await Collection.findOne({ title : `${col}`}));
        const colId = col._id;
        if (col.sharedWith == []){
          sharedList.push(colId);
        }
        collectionSearchArray.push({ collectionId: `${colId}` });
      }
      collectionSearch = { collectionId: { $in: collectionSearchArray.map((obj) => obj.collectionId) } };

    }

    let sort;
    switch (sortBy) {
      case 'latest':
        sort = { createdAt: -1 };
        break;
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'sortAsc':
        sort = { title: 1 };
        break;
      case 'sortDesc':
        sort = { title: -1} ;
        break;
      default:
        sort = { createdAt: -1 }; 
        break;
    }

    let filterSearch;
    // 검색 기능 
    switch (filterBy) {
      case 'title':
        filterSearch = { title: { $regex: `${search}`, $options: 'i' } };
        break;
      case 'keyword':
        filterSearch = { keywords: { $regex: `${search}`, $options: 'i'}};
        break;
      case "all":
        filterSearch = {
          $or: [
            { title: { $regex: `${search}`, $options: 'i' } },
            { keywords: { $regex: `${search}`, $options: 'i' } },
          ],
        };
        break;
      default:
        filterSearch = {};
    }


    const totalItemCount = await Reference.countDocuments({
      ...collectionSearch,
      ...filterSearch,
    });
    if (totalItemCount == 0) {
      res.status(201).json({ message: "검색 결과가 없어요.\n다른 검색어로 시도해 보세요!"})
    } else {
      const totalPages = Math.ceil(totalItemCount/limit);
      const currentPage = Number(page) > totalPages ? totalPages : Number(page);
      const skip = (currentPage - 1) * limit;

      const data = await Reference.find({
        ...collectionSearch,
        ...filterSearch,
      })
        .skip(skip)
        .limit(limit)
        .sort(sort);
  
        let finalData;
        switch (view) {
          case 'card':
            finalData = data.map((item, index) => ({
              ...item.toObject(), 
              sharing: sharedList.includes(item.collectionId)
            }));
            break;
          case 'list':
            finalData = data.map((item, index) => ({
              ...item.toObject(), 
              number: skip + index + 1
            }));
            break;
          default:
            finalData = data.map((item, index) => ({
              ...item.toObject(), 
              sharing: sharedList.includes(item.collectionId)
            }));
            break;
        }

        res.status(201).json({
          currentPage: currentPage,
          totalPages: totalPages,
          totalItemCount: totalItemCount,
          data: finalData
        });
    }
  } catch (error) {
    res.status(500).json({ message: "레퍼런스 조회 오류", error: error.message });
}
}
