import User from "../models/User.js";
import Collection from "../models/Collection.js";
import CollectionShare from "../models/CollectionShare.js";
import CollectionFavorite from "../models/CollectionFavorite.js";

import { StatusCodes } from "http-status-codes";
import { smtpTransport } from "../config/email.js";
import path from "path";
import ejs from "ejs";

const appDir = path.resolve();

const sendEmail = async (
  email,
  ownerName,
  invitedName,
  collectionName,
  link
) => {
  const emailTemplatePath = path.join(appDir, "templates", "inviteEmail.ejs");
  const emailTemplate = await ejs.renderFile(emailTemplatePath, {
    owner: ownerName,
    name: invitedName,
    collection: collectionName,
    link: link,
  });
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `📁RefHub📁 ${ownerName}님이 ${collectionName} 컬렉션에 초대했습니다.`,
    html: emailTemplate,
    attachments: [
      {
        filename: "logo.png",
        path: path.join(appDir, "templates", "logo.png"),
        cid: "logo",
      },
    ],
  };
  try {
    await smtpTransport.sendMail(mailOptions);
    console.log("Email send successfully");
  } catch (err) {
    console.error("Email send failed", err);
    throw new Error("메일 발송 실패");
  }
};

// 컬렉션 나만 보기
const setPrivate = async (req, res, next) => {
  const collectionId = req.params.collectionId;
  const user = req.user.id;

  try {
    // 본인의 컬렉션인지 확인
    const collection = await Collection.findOne({
      _id: collectionId,
      createdBy: user,
    }).lean();

    if (!collection) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 공유 + 즐겨찾기 문서 삭제
    await Promise.all([
      CollectionFavorite.deleteMany({ collectionId }),
      CollectionShare.deleteMany({ collectionId }),
    ]);
    return res.status(StatusCodes.OK).json({ message: "나만 보기 설정 완료" });
  } catch (err) {
    next(err);
  }
};

// 공유 사용자 조회
const getSharedUsers = async (req, res, next) => {
  const collectionId = req.params.collectionId;
  const user = req.user.id;

  try {
    const collection = await Collection.findById(collectionId);

    if (!collection) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "존재하지 않습니다." });
    }

    // 생성자 & 공유자 확인
    const isOwner = collection.createdBy.toString() === user;
    const isSharedUser = await CollectionShare.findOne({
      collectionId: collectionId,
      userId: user,
    }).lean();

    // 둘 다 아님
    if (!isOwner && isSharedUser === null) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    const owner = await User.findById(user);
    const modefiedOwner = {
      _id: owner._id,
      name: owner.name,
      email: owner.email,
    };
    const sharing = await CollectionShare.find({ collectionId })
      .populate("userId", "name email")
      .lean();

    return res.status(StatusCodes.OK).json({
      owner: modefiedOwner,
      sharing: sharing,
    });
  } catch (err) {
    next(err);
  }
};

// 공유 사용자 추가 및 메일 발송
const updateSharedUsers = async (req, res, next) => {
  const collectionId = req.params.collectionId;
  const user = req.user.id;
  const { email, role } = req.body;

  try {
    const collection = await Collection.findOne({
      _id: collectionId,
      createdBy: user,
    });

    if (!collection) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 유저가 없으면 새로 추가
    let newUser = await User.findOne({ email });
    if (!newUser) {
      newUser = new User({ email, name: "", role: "viewer" });
      await newUser.save();
    }

    // 본인에게 공유 시 에러
    if (newUser._id.toString() === collection.createdBy.toString()) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "본인에게 공유할 수 없습니다." }); // 추가
    }

    // 이미 공유되고 있는지 확인
    const existingUser = await CollectionShare.findOne({
      collectionId: collectionId,
      userId: newUser._id,
    });

    // 공유 중이라면 역할 수정
    if (existingUser) {
      existingUser.role = role;
      await existingUser.save();
      return res.status(StatusCodes.OK).json({ message: "사용자 수정 성공" });
    } else {
      // 공유 중이 아니라면 추가
      const newShare = new CollectionShare({
        collectionId: collectionId,
        userId: newUser._id,
        role: role,
      });
      await newShare.save();

      const [owner, invited] = await Promise.all([
        User.findById(collection.createdBy),
        User.findById(newUser._id),
      ]);

      const ownerName = owner?.name || "";
      const invitedName =
        invited?.name === "" ? email.split("@")[0] : invited?.name;
      const collectionName = collection.title;
      const link = `https://test.com/references?collection=${collectionName}`; // 수정 필요

      // 메일 발송
      try {
        await sendEmail(email, ownerName, invitedName, collectionName, link);
        return res
          .status(StatusCodes.CREATED)
          .json({ message: "사용자 추가 및 메일 보내기 성공" });
      } catch (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ error: "메일 발송 중 오류가 발생하였습니다." });
      }
    }
  } catch (err) {
    next();
  }
};

// 공유 사용자 삭제 (컬렉션 나가기)
const deleteSharedUser = async (req, res, next) => {
  const { collectionId, userId } = req.params;
  const user = req.user.id;

  try {
    // 찾을 수 없음
    const collection = await Collection.findById(collectionId).lean();
    if (!collection) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 공유 중인 사용자인지 확인
    const sharing = await CollectionShare.findOne({
      collectionId,
      userId,
    }).lean();
    if (!sharing) {
      return res.status(StatusCodes.OK).json({
        message: "공유 중인 사용자가 아닙니다.",
      });
    }

    // 생성자/공유자 본인 확인
    const isOwner = collection.createdBy.toString() === user;
    const isSharedUser = sharing && sharing.userId.toString() === user;

    // 둘 다 아님
    if (!isOwner && !isSharedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 공유 + 즐겨찾기 문서 삭제
    await Promise.all([
      CollectionFavorite.deleteOne({ collectionId }),
      CollectionShare.deleteOne({ collectionId }),
    ]);
    return res.status(StatusCodes.OK).json({
      message: "사용자 삭제 완료",
    });
  } catch (err) {
    next(err);
  }
};

export default {
  setPrivate,
  getSharedUsers,
  updateSharedUsers,
  deleteSharedUser,
};
