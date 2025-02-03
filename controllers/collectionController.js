import { StatusCodes } from "http-status-codes";
import Collection from "../models/Collection.js";
import Reference from "../models/Reference.js";
import CollectionFavorite from "../models/CollectionFavorite.js";
import CollectionShare from "../models/CollectionShare.js";
import { MongoError } from "mongodb";

// 컬렉션 생성
const createCollection = async (req, res, next) => {
  try {
    const { title } = req.body;
    const user = req.user.id;

    // 공유 중인 컬렉션 검사
    const sharedCollection = await CollectionShare.find({
      userId: user,
    }).lean();

    const sharedTitles = await Promise.all(
      sharedCollection.map(async (share) => {
        const collection = await Collection.findById(share.collectionId).lean();
        return collection ? collection.title : null;
      })
    )

    if (sharedTitles.includes(title)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "공유 중인 컬렉션과 중복된 이름입니다.",
      });
    }

    // 생성한 컬렉션 검사
    const collExists = await Collection.findOne({
      title: title,
      createdBy: user,
    });
    if (collExists) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "중복된 이름입니다.",
      });
    }

    // 컬렉션 생성
    const coll = await Collection.create({
      title: title,
      createdBy: user,
    });
    return res.status(StatusCodes.CREATED).json(coll);
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
    const myColletions = await Collection.find({
      ...searchCondition,
      createdBy: user,
    }).lean();

    const sharedColletions = await CollectionShare.find({
      userId: user,
    }).distinct("collectionId");

    const sharedCollectionData = await Collection.find({
      ...searchCondition,
      _id: { $in: sharedColletions },
    }).lean();

    const allCollections = [...myColletions, ...sharedCollectionData];
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

    // 조건 필터링
    const sortOptions = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      sortAsc: { title: 1 },
      sortDesc: { title: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.latest;

    const totalPages = Math.ceil(totalItemCount / pageSize);
    const currentPage = Math.min(validPage, totalPages);
    const skip = (currentPage - 1) * pageSize;

    // 컬렉션 페이지네이션
    const paginatedCollections = allCollections
      .sort(
        (a, b) =>
          sort[Object.keys(sort)[0]] *
          (a[Object.keys(sort)[0]] > b[Object.keys(sort)[0]] ? 1 : -1)
      )
      .slice(skip, skip + pageSize);

    const collectionFavorites = await CollectionFavorite.find({
      userId: user,
      collectionId: { $in: paginatedCollections.map((item) => item._id) },
    }).lean();

    const references = await Reference.find({
      collectionId: { $in: paginatedCollections.map((item) => item._id) },
    }).lean();

    const checkIfShared = async (collectionId) => {
      const sharedExists = await CollectionShare.exists({ collectionId });
      return sharedExists ? true : false;
    };

    // 반환 데이터 재구성
    const modifiedData = await Promise.all(
      paginatedCollections.map(async (item) => {
        // 즐겨찾기 여부
        const isFavorite = collectionFavorites.some(
          (favorite) =>
            favorite.collectionId.toString() === item._id.toString() &&
            favorite.isFavorite
        );

        // 참조 수
        const refCount = references.filter(
          (ref) => ref.collectionId.toString() === item._id.toString()
        ).length;

        // 프리뷰 이미지
        const limit = Math.max(Math.min(refCount, 4), 0);
        const relevantReferences = references
          .filter((ref) => ref.collectionId.toString() === item._id.toString())
          .slice(0, limit);

        const previewImages = relevantReferences.map((reference) => {
          const file = reference.files.find(
            (file) => file.type === "image" || reference.files[0]
          );
          return file ? file.previewURLs?.[0] || file.previewURL : null;
        });

        // 공유된 컬렉션인지 확인
        const isShared = await checkIfShared(item._id);

        return {
          _id: item._id,
          title: item.title,
          isFavorite: isFavorite,
          isShared: isShared,
          createdBy: item.createdBy,
          createdAt: item.createdAt,
          refCount: refCount,
          previewImages: previewImages,
        };
      })
    );
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
    const coll = await Collection.findOneAndUpdate(
      { _id: collectionId, createdBy: user },
      { $set: { title: title } },
      { new: true, runValidators: true }
    );

    if (!coll) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    return res.status(StatusCodes.OK).json(coll);
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
  const createdBy = req.user.id;

  try {
    // 생성자인지 확인
    const collections = await Collection.find({
      _id: { $in: collectionIds },
      createdBy: createdBy,
    });

    if (collections.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 컬렉션 참조 문서 + 컬렉션 삭제
    await CollectionFavorite.deleteMany({
      collectionId: { $in: collections.map((item) => item._id) },
    });
    await CollectionShare.deleteMany({
      collectionId: { $in: collections.map((item) => item._id) },
    });
    await Reference.deleteMany({
      collectionId: { $in: collections.map((item) => item._id) },
    });
    await Collection.deleteMany({
      _id: { $in: collections.map((item) => item._id) },
    });

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
  const createdBy = req.user.id;

  try {
    const coll = await Collection.findById(collectionId);

    if (!coll) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "존재하지 않습니다." });
    }

    let favorite = await CollectionFavorite.findOne({
      userId: createdBy,
      collectionId: collectionId,
    });

    if (!favorite) {
      // 즐겨찾기 정보 없음 → 새 문서 생성 (즐겨찾기 추가)
      const favorite = new CollectionFavorite({
        userId: createdBy,
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
