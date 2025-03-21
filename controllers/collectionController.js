import Collection from "../models/Collection.js";
import CollectionFavorite from "../models/CollectionFavorite.js";
import CollectionShare from "../models/CollectionShare.js";

import { StatusCodes } from "http-status-codes";
import Reference from "../models/Reference.js";
import { MongoError } from "mongodb";
import mongoose from "mongoose";
import ogs from "open-graph-scraper";

async function getOGImage(url) {
  try {
    const { result } = await ogs({ url });
    return result.ogImage[0]?.url;
  } catch (err) {
    console.log(`OG Image fetch error (${url}:)`, err.message);
    return null;
  }
}

// 컬렉션 생성
const createCollection = async (req, res, next) => {
  try {
    const { title } = req.body;
    const user = req.user.id;

    // 공유 받은 컬렉션 검사
    const sharedCollection = await CollectionShare.find({
      userId: user,
    }).lean();

    const sharedTitles = await Promise.all(
      sharedCollection.map(async (share) => {
        const collection = await Collection.findById(share.collectionId).lean();
        return collection ? collection.title : null;
      })
    );
    if (sharedTitles.includes(title)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "공유 중인 컬렉션과 중복된 이름입니다.",
      });
    }

    // 생성했던 컬렉션 검사
    const collectionExists = await Collection.exists({
      title: title,
      createdBy: user,
    });
    if (collectionExists) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "중복된 이름입니다.",
      });
    }

    // 컬렉션 생성
    const collection = await Collection.create({
      title: title,
      createdBy: user,
    });
    return res.status(StatusCodes.CREATED).json(collection);
  } catch (err) {
    next(err);
  }
};

// 컬렉션 목록 조회
const getCollection = async (req, res, next) => {
  try {
    const { page = 1, sortBy = "latest", search = "" } = req.query;
    const pageSize = 15;
    const user = req.user.id;

    // 검색 조건 설정
    const searchCondition = search
      ? { title: { $regex: search, $options: "i" } }
      : {};

    // 컬렉션 전체 개수 및 메시지 전달
    const myCollections = await Collection.find({
      ...searchCondition,
      createdBy: user,
    }).lean();

    // 공유받은 컬렉션 조회
    const sharedCollectionIds = await CollectionShare.find({
      userId: user,
    }).distinct("collectionId");
    const sharedCollections = await Collection.find({
      ...searchCondition,
      _id: { $in: sharedCollectionIds },
    }).lean();

    // 생성 + 공유 컬렉션 합치기
    const allCollections = [...myCollections, ...sharedCollections];
    const totalItemCount = allCollections.length;

    if (totalItemCount === 0) {
      return res.status(StatusCodes.OK).json({
        message: search
          ? "검색 결과가 없어요. 다른 검색어로 시도해보세요!"
          : "아직 생성된 컬렉션이 없어요. 새 컬렉션을 만들어 정리를 시작해보세요!",
      });
    }

    // 페이지 유효성 검사
    const parsedPage = parseInt(page, 10);
    const validPage = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    // 정렬 조건
    const sortOptions = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      sortAsc: { title: 1 },
      sortDesc: { title: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.latest;

    // 컬렉션 페이지네이션
    const totalPages = Math.ceil(totalItemCount / pageSize);
    const currentPage = Math.min(validPage, totalPages);
    const skip = (currentPage - 1) * pageSize;

    // 정렬 후 페이지네이션 적용
    const paginatedCollections = allCollections
      .sort(
        (a, b) =>
          sort[Object.keys(sort)[0]] *
          (a[Object.keys(sort)[0]] > b[Object.keys(sort)[0]] ? 1 : -1)
      )
      .slice(skip, skip + pageSize);

    // 즐겨찾기 정보 조회
    const collectionIds = paginatedCollections.map((item) => item._id);
    const [collectionFavorites, references] = await Promise.all([
      CollectionFavorite.find({
        userId: user,
        collectionId: { $in: collectionIds },
      }).lean(),
      Reference.find({ collectionId: { $in: collectionIds } }).lean(),
    ]);

    // 공유 정보 조회
    const checkIfShared = async (collectionId) => {
      const sharedExists = await CollectionShare.exists({ collectionId });
      return sharedExists ? true : false;
    };

    // 반환 데이터 재구성
    const modifiedData = await Promise.all(
      paginatedCollections.map(async (item) => {
        // 즐겨찾기 여부
        const isFavorite = collectionFavorites.some(
          (fav) =>
            fav.collectionId.toString() === item._id.toString() &&
            fav.isFavorite
        );

        const refList = references.filter(
          (ref) => ref.collectionId.toString() === item._id.toString()
        );
        const refCount = refList.length;
        const relevantReferences = refList.slice(0, Math.min(refCount, 4));

        // 프리뷰 이미지
        const previewImages = await Promise.all(
          relevantReferences.map(async (reference) => {
            const file = reference.files[0];
            if (!file) return null;

            switch (file.type) {
              case "link":
                return await getOGImage(file.previewURL);
              case "image":
              case "pdf":
              case "otherfiles":
              default:
                return file.previewURLs?.[0] || file.previewURL;
            }
          })
        );

        const role = await CollectionShare.findOne({
          collectionId: item._id,
        }).distinct("role");

        const isShared = await checkIfShared(item._id);
        const isCreator = item.createdBy.toString() === user;
        const isViewer = role[0] === "viewer";
        const isEditor = role[0] === "editor";

        console.log(isCreator, isViewer, isEditor);

        return {
          _id: item._id,
          title: item.title,
          isFavorite: isFavorite,
          isShared: isShared,
          creator: isCreator,
          viewer: isViewer,
          editor: isEditor,
          shared: isShared,
          creator: isCreator,
          viewer: isViewer,
          editor: isEditor,
          createdBy: item.createdBy,
          createdAt: item.createdAt,
          refCount: refCount,
          previewImages: previewImages,
        };
      })
    );
    // 즐겨찾기 여부 기준 정렬
    modifiedData.sort((a, b) => b.isFavorite - a.isFavorite);

    return res.status(StatusCodes.OK).json({
      currentPage: validPage,
      totalPages,
      totalItemCount,
      data: modifiedData,
    });
  } catch (err) {
    next(err);
  }
};

// 컬렉션 수정
const updateCollection = async (req, res, next) => {
  const { collectionId } = req.params;
  const { title } = req.body;
  const user = req.user.id;

  try {
    // 공유 중인 컬렉션 검사
    const sharedCollection = await CollectionShare.find({
      userId: user,
    }).lean();

    const sharedTitles = await Promise.all(
      sharedCollection.map(async (share) => {
        const collection = await Collection.findById(share.collectionId).lean();
        return collection ? collection.title : null;
      })
    );

    if (sharedTitles.includes(title)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "공유 중인 컬렉션과 중복된 이름입니다.",
      });
    }

    // 컬렉션 수정
    const collection = await Collection.findOneAndUpdate(
      { _id: collectionId, createdBy: user },
      { $set: { title: title } },
      { new: true, runValidators: true }
    );

    if (!collection) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    return res.status(StatusCodes.OK).json(collection);
  } catch (err) {
    if (err instanceof MongoError && err.code === 11000) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "중복된 이름입니다.",
      });
    }
    next(err);
  }
};

// 컬렉션 삭제 (삭제모드 포함)
const deleteCollection = async (req, res, next) => {
  const { collectionIds } = req.body;
  const user = req.user.id;

  try {
    // 생성자인지 확인
    const collections = await Collection.find({
      _id: { $in: collectionIds },
      createdBy: user,
    }).lean();

    if (collections.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 컬렉션 연관 문서 삭제
    const collectionIdsToDelete = collections.map((item) => item._id);

    const references = await Reference.find({
      collectionId: { $in: collectionIdsToDelete },
    }).lean();

    const db = mongoose.connection.db; // MongoDB 연결 객체
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "uploads",
    });

    // 첨부 자료 삭제
    for (const reference of references) {
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
    }
    await Promise.all([
      Reference.deleteMany({
        collectionId: { $in: collectionIdsToDelete },
      }),
      CollectionShare.deleteMany({
        collectionId: { $in: collectionIdsToDelete },
      }),
      CollectionFavorite.deleteMany({
        collectionId: { $in: collectionIdsToDelete },
      }),
      Collection.deleteMany({
        _id: { $in: collectionIdsToDelete },
      }),
    ]);

    return res
      .status(StatusCodes.OK)
      .json({ message: "삭제가 완료되었습니다." });
  } catch (err) {
    next(err);
  }
};

// 컬렉션 즐겨찾기
const toggleFavorite = async (req, res, next) => {
  const { collectionId } = req.params;
  const user = req.user.id;

  try {
    // 존재 여부 확인
    const collection = await Collection.findById(collectionId).lean();
    if (!collection) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "존재하지 않습니다." });
    }

    // 즐겨찾기에 정보 있는지 확인
    let favorite = await CollectionFavorite.findOne({
      userId: user,
      collectionId: collectionId,
    });

    if (!favorite) {
      // 즐겨찾기 정보 없음 → 새 문서 생성 (즐겨찾기 추가)
      const favorite = new CollectionFavorite({
        userId: user,
        collectionId: collectionId,
        isFavorite: true,
      });
      await favorite.save();
      return res.status(StatusCodes.OK).json({
        message: "컬렉션 즐겨찾기 등록 성공",
        data: true,
      });
    } else {
      // 즐겨찾기 정보 있음 → 업데이트
      favorite.isFavorite = !favorite.isFavorite;
      await favorite.save();
      return res.status(StatusCodes.OK).json({
        message: favorite.isFavorite
          ? "컬렉션 즐겨찾기 등록 성공"
          : "컬렉션 즐겨찾기 해제 성공",
        data: favorite.isFavorite,
      });
    }
  } catch (err) {
    next(err);
  }
};

export default {
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  toggleFavorite,
};
