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
    return result.ogImage[0]?.url || null;
  } catch (err) {
    console.log(`OG Image fetch error (${url}:)`, err.message);
    return null;
  }
}

// 컬렉션 생성
const createCollection = async (req, res, next) => {
  try {
    const { title } = req.body;
    const userId = req.user.id;

    const [sharedTitles, collectionExists] = await Promise.all([
      Collection.find({
        _id: {
          $in: await CollectionShare.distinct("collectionId", {
            userId: userId,
          }),
        },
      })
        .lean()
        .distinct("title"),
      Collection.exists({ title, createdBy: userId }),
    ]);

    if (sharedTitles.includes(title) || collectionExists) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "이미 동일한 이름의 컬렉션이 있습니다.",
      });
    }

    // 컬렉션 생성
    const collection = await Collection.create({
      title: title,
      createdBy: userId,
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
    const userId = req.user.id;

    // 검색 조건 설정
    const searchCondition = search
      ? { title: { $regex: search, $options: "i" } }
      : {};

    // 정렬 조건
    const sortOptions = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      sortAsc: { title: 1 },
      sortDesc: { title: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.latest;

    // 컬렉션 전체 개수 및 메시지 전달
    const collections = await Collection.find({
      ...searchCondition,
      $or: [
        { createdBy: userId }, // 사용자가 만든 컬렉션
        {
          _id: {
            $in: await CollectionShare.find({ userId }).distinct(
              "collectionId"
            ),
          },
        }, // 사용자가 공유받은 컬렉션
      ],
    })
      .sort(sort)
      .lean();

    if (collections.length === 0) {
      return res.status(StatusCodes.OK).json({
        message: search
          ? "검색 결과가 없어요. 다른 검색어로 시도해보세요!"
          : "아직 생성된 컬렉션이 없어요. 새 컬렉션을 만들어 정리를 시작해보세요!",
      });
    }

    // 페이지 유효성 검사 && 페이지네이션
    const totalItemCount = collections.length;
    const totalPages = Math.ceil(totalItemCount / pageSize);
    const currentPage = Math.min(Math.max(1, parseInt(page, 10)), totalPages);
    const paginatedCollections = collections.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

    // 즐겨찾기, 레퍼런스, 공유 정보 조회
    const collectionIds = paginatedCollections.map((item) => item._id);
    const [collectionFavorites, references, collectionShared] =
      await Promise.all([
        CollectionFavorite.find({
          userId: userId,
          collectionId: { $in: collectionIds },
        }).lean(),
        Reference.find({ collectionId: { $in: collectionIds } }).lean(),
        CollectionShare.find({ collectionId: { $in: collectionIds } }).lean(),
      ]);

    // 반환 데이터 재구성
    const modifiedData = await Promise.all(
      paginatedCollections.map(async (item) => {
        // 즐겨찾기 여부
        const isFavorite = collectionFavorites.some(
          (fav) => fav.collectionId.equals(item._id) && fav.isFavorite
        );
        const refList = references.filter((ref) =>
          ref.collectionId.equals(item._id)
        );

        // 프리뷰 이미지
        const relevantReferences = refList.slice(-4).reverse();

        const URLs = [];
        for (const ref of relevantReferences) {
          if (Array.isArray(ref.files)) {
            for (const file of ref.files) {
              switch (file.type) {
                case "image":
                  URLs.push(
                    ...file.previewURLs.map((url) => ({ type: file.type, url }))
                  );
                  break;
                case "link":
                case "pdf":
                default:
                  URLs.push({ type: file.type, url: file.previewURL });
                  break;
              }
              if (URLs.length >= 4) break;
            }
          }
          if (URLs.length >= 4) break;
        }
        /*
        const URLs =
          relevantReferences.flatMap((ref) => {
            if (Array.isArray(ref.files)) {
              return ref.files.flatMap((file) => {
                switch (file.type) {
                  case "image":
                    return file.previewURLs.map((url) => ({
                      type: file.type,
                      url,
                    }));
                  case "link":
                  case "pdf":
                    return { type: file.type, url: file.previewURL };
                  default:
                    return [];
                }
              });
            }
            return [];
          }) || [];
           */

        let previewImages = await Promise.all(
          URLs.map(async (file) => {
            try {
              switch (file.type) {
                case "link":
                  return getOGImage(file.url);
                case "image":
                case "pdf":
                  return file.url;
                default:
                  return null;
              }
            } catch (err) {
              console.error(`OGS error for ${file.url}`, err);
              return null;
            }
          })
        );
        /*
        for (const file of URLs) {
          if (previewImages.length >= 4) break;
          try {
            switch (file.type) {
              case "link":
                previewImages.push(await getOGImage(file.url));
                break;
              case "image":
              case "pdf":
                previewImages.push(file.url);
                break;
              default:
                previewImages.push(null);
                break;
            }
          } catch (err) {
            console.error(`OGS error for ${file.url}`, err);
            previewImages.push(null);
          }
        }
          */

        /*
        // 프리뷰 이미지
        const previewImages = await Promise.all(
          relevantReferences.map(async (reference) => {
            const file = reference.files[0];
            if (!file) return null;

            switch (file.type) {
              case "link":
                return await getOGImage(file.previewURL);
              case "image":
                return file.previewURLs?.[0] || null;
              case "pdf":
              case "otherfiles":
              default:
                return file.previewURL || null;
            }
          })
        );
        */

        const sharedEntry = collectionShared.find(
          (share) =>
            share.collectionId.equals(item._id) && share.userId.equals(userId)
        );
        const role = sharedEntry ? sharedEntry.role : null;
        const isShared = collectionShared.some((share) =>
          share.collectionId.equals(item._id)
        );
        const isCreator = item.createdBy.equals(userId);
        const isViewer = role === "viewer";
        const isEditor = role === "editor";

        return {
          _id: item._id,
          title: item.title,
          isFavorite: isFavorite,
          isShared: isShared,
          creator: isCreator,
          viewer: isViewer,
          editor: isEditor,
          createdBy: item.createdBy,
          createdAt: item.createdAt,
          refCount: refList.length,
          previewImages: previewImages,
        };
      })
    );
    // 즐겨찾기 여부 기준 정렬
    modifiedData.sort((a, b) => b.isFavorite - a.isFavorite);

    return res.status(StatusCodes.OK).json({
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
  const { collectionId } = req.params;
  const { title } = req.body;
  const userId = req.user.id;

  try {
    // 컬렉션 존재 확인

    const [collection, role] = await Promise.all([
      Collection.findById(collectionId).lean(),
      CollectionShare.distinct("role", {
        collectionId: collectionId,
        userId: userId,
      }).lean(),
    ]);

    if (!collection) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    const owner = collection.createdBy;
    const isOwner = owner.equals(userId);
    const isEditor = role[0] === "editor";

    if (!isOwner && !isEditor) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    const [sharedTitles, collectionExists] = await Promise.all([
      Collection.find({
        _id: {
          $in: await CollectionShare.distinct("collectionId", {
            userId: userId,
          }),
        },
      })
        .lean()
        .distinct("title"),
      Collection.exists({ title, createdBy: userId }),
    ]);

    if (sharedTitles.includes(title) || collectionExists) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "이미 동일한 이름의 컬렉션이 있습니다.",
      });
    }

    // 컬렉션 찾고 업데이트
    const collectionUpdate = await Collection.findOneAndUpdate(
      { _id: collectionId, createdBy: owner },
      { $set: { title: title } },
      { new: true, runValidators: true }
    );

    if (!collectionUpdate) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "컬렉션 수정 중 오류가 발생했습니다.",
      });
    }

    return res.status(StatusCodes.OK).json(collectionUpdate);
  } catch (err) {
    if (err instanceof MongoError && err.code === 11000) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "이미 동일한 이름의 컬렉션이 있습니다.",
      });
    }
    next(err);
  }
};

// 컬렉션 이동모드
const moveCollection = async (req, res, next) => {
  const { collectionIds } = req.body;
  const { newCollection } = req.body;
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

    // 헤딩 컬렉션 레퍼런스 찾기
    const referenceIds = await Reference.find({
      collectionId: { $in: collectionIds },
    });

    if (referenceIds.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "해당 컬렉션을 참조하는 레퍼런스가 없습니다.",
      });
    }

    // 레퍼런스 컬렉션 아이디 업데이트
    await Reference.updateMany(
      { _id: { $in: referenceIds.map((ref) => ref._id) } },
      { $set: { collectionId: newCollection } }
    );

    return res.status(StatusCodes.OK).json({
      message: "이동이 완료되었습니다.",
      updatedCount: referenceIds.length,
    });
  } catch (err) {
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
  moveCollection,
  toggleFavorite,
};
