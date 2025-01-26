import { StatusCodes } from "http-status-codes";
import Collection from "../models/Collection.js";
import Reference from "../models/Reference.js";
import { MongoError } from "mongodb";

// 컬렉션 생성
const createCollection = async (req, res, next) => {
  try {
    const { title } = req.body;
    const createdBy = req.user.id;

    const coll = await Collection.create({
      title: title,
      createdBy: createdBy,
    });
    res.status(StatusCodes.CREATED).json(coll);
  } catch (err) {
    if (err instanceof MongoError && err.code === 11000) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "중복된 이름입니다.",
      });
      return;
    }
    next(err);
  }
};

// 컬렉션 목록 조회
const getCollection = async (req, res, next) => {
  try {
    const { page = 1, sortBy = "latest", search = "" } = req.query;
    const pageSize = 15;
    const createdBy = req.user.id;

    // 페이지 유효성 검사
    const parsedPage = parseInt(page, 10);
    const validPage = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    // 조건 필터링
    const sortOptions = {
      latest: { isFavorite: -1, createdAt: -1 },
      oldest: { isFavorite: -1, createdAt: 1 },
      sortAsc: { isFavorite: -1, title: 1 },
      sortDesc: { isFavorite: -1, title: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.latest;

    const searchCondition = search
      ? { title: { $regex: search, $options: "i" } }
      : {};

    // 컬렉션 전체 개수 및 오류 
    const totalItemCount = await Collection.countDocuments({
      ...searchCondition,
      $or: [{ createdBy: createdBy }, { "sharedWith.userId": createdBy }],
    });

    if (totalItemCount === 0) {
      if (search === "") {
        return res.status(StatusCodes.OK).json({
          message:
            "아직 생성된 컬렉션이 없어요. 새 컬렉션을 만들어 정리를 시작해보세요!",
        });
      } else {
        return res.status(StatusCodes.OK).json({
          message: "검색 결과가 없어요. 다른 검색어로 시도해보세요!",
        });
      }
    }

    const totalPages = Math.ceil(totalItemCount / pageSize);
    const currentPage = Math.min(validPage, totalPages);
    const skip = (currentPage - 1) * pageSize;

    // 컬렉션 페이지네이션
    const data = await Collection.find({
      ...searchCondition,
      $or: [{ createdBy: createdBy }, { "sharedWith.userId": createdBy }],
    })
      .skip(skip)
      .limit(pageSize)
      .sort(sort);

    // 반환 데이터 재구성
    const modifiedData = await Promise.all(
      data.map(async (item) => {
        const refCount = await Reference.countDocuments({
          collectionId: item._id,
        });
        item.refCount = refCount;
        return {
          _id: item._id,
          title: item.title,
          isFavorite: item.isFavorite,
          createdBy: item.createdBy,
          sharedWith: item.sharedWith,
          createdAt: item.createdAt,
          refCount: item.refCount,
          // image: item.image, // 필요 시 추가
        };
      })
    );

    res.status(StatusCodes.OK).json({
      currentPage,
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
  try {
    const { collectionId } = req.params;
    const { title } = req.body;
    const coll = await Collection.findOneAndUpdate(
      { _id: collectionId },
      { $set: { title: title } },
      { new: true, runValidators: true }
    );

    res.status(StatusCodes.OK).json(coll);
  } catch (err) {
    if (err instanceof MongoError && err.code === 11000) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "중복된 이름입니다.",
      });
      return;
    }
    next(err);
  }
};

// 컬렉션 삭제 (삭제모드 포함)
const deleteCollection = async (req, res, next) => {
  try {
    const { collectionIds } = req.body;
    const coll = await Collection.deleteMany({
      _id: { $in: collectionIds },
    });

    if (
      !collectionIds ||
      !Array.isArray(collectionIds) ||
      collectionIds.length === 0
    ) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "선택한 컬렉션이 없습니다." });
      return;
    }

    if (coll.deletedCount === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
      return;
    }

    res.status(StatusCodes.OK).json({ message: "삭제가 완료되었습니다." });
  } catch (err) {
    next(err);
  }
};

// 컬렉션 즐겨찾기
const toggleFavorite = async (req, res, next) => {
  try {
    const { collectionId } = req.params;
    const coll = await Collection.findById(collectionId);

    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).json({ error: "존재하지 않습니다." });
      return;
    }

    coll.isFavorite = !coll.isFavorite;
    const updatedCollection = await coll.save();
    const message = updatedCollection.isFavorite
      ? "컬렉션 즐겨찾기 등록 성공"
      : "컬렉션 즐겨찾기 해제 성공";

    res.status(StatusCodes.OK).json({
      message: message,
      data: `${updatedCollection.isFavorite}`,
    });
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
