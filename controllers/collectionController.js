import { StatusCodes } from "http-status-codes";
import Collection from "../models/Collection.js";
import { Reference } from "../models/Reference.js";
import { MongoError } from "mongodb";

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

const getCollection = async (req, res, next) => {
  try {
    const { page = 1, sortBy = "latest", search = "" } = req.query;
    const pageSize = 15;
    const createdBy = req.user.id;

    let sort = {};
    switch (sortBy) {
      case "latest":
        sort = { isFavorite: -1, createdAt: -1 };
        break;
      case "oldest":
        sort = { isFavorite: -1, createdAt: 1 };
        break;
      case "sortAsc":
        sort = { isFavorite: -1, title: 1 };
        break;
      case "sortDesc":
        sort = { isFavorite: -1, title: -1 };
        break;
      default:
        sort = { isFavorite: -1, createdAt: -1 };
        break;
    }

    const searchCondition = search
      ? { title: { $regex: search, $options: "i" } }
      : {};

    const totalItemCount = await Collection.countDocuments({
      ...searchCondition,
      $or: [{ createdBy: createdBy }, { "sharedWith.userId": createdBy }],
    });

    const totalPages = Math.ceil(totalItemCount / pageSize);
    const currentPage = Number(page) > totalPages ? totalPages : Number(page);
    const skip = (currentPage - 1) * pageSize;
    const limit = pageSize;

    const data = await Collection.find({
      ...searchCondition,
      $or: [{ createdBy: createdBy }, { "sharedWith.userId": createdBy }],
    })
      .skip(skip)
      .limit(limit)
      .sort(sort);

    const modifiedData = [];
    for (let item of data) {
      const itemObj = item.toObject();
      // Reference.countDocuments 컬렉션 참조하도록 수정 필요
      const refCount = await Reference.countDocuments({
        collectionId: itemObj._id,
      });
      itemObj.refCount = refCount;
      modifiedData.push(itemObj);
    }

    res.status(StatusCodes.OK).json({
      currentPage: currentPage,
      totalPages: totalPages,
      totalItemCount: totalItemCount,
      data: modifiedData.map((item) => ({
        _id: item._id,
        title: item.title,
        isFavorite: item.isFavorite,
        createdBy: item.createdBy,
        sharedWith: item.sharedWith,
        createdAt: item.createdAt,
        refCount: item.refCount,
        // image: item.image, // 필요 시 추가
      })),
    });
  } catch (err) {
    next(err);
  }
};

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
      res.status(StatusCodes.BAD_REQUEST).json({ error: "잘못된 요청입니다." });
      return;
    }

    if (coll.deletedCount === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
      return;
    }

    res
      .status(StatusCodes.OK)
      .json({ message: `${coll.deletedCount}개의 컬렉션이 삭제되었습니다.` });
  } catch (err) {
    next(err);
  }
};

const toggleFavorite = async (req, res, next) => {
  try {
    const { collectionId } = req.params;
    const coll = await Collection.findById(collectionId);

    if (!coll) {
      res.status(StatusCodes.BAD_REQUEST).json({ error: "잘못된 요청입니다." });
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
