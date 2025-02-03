import { StatusCodes } from "http-status-codes";
import Collection from "../models/Collection.js";
import User from "../models/User.js";
import CollectionShare from "../models/CollectionShare.js";
import { smtpTransport } from "../config/email.js";
import path from "path";
import ejs from "ejs";
import CollectionFavorite from "../models/CollectionFavorite.js";

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
    const coll = await Collection.findOne({
      _id: collectionId,
      createdBy: user,
    }).lean();

    if (!coll) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 공유 정보 삭제
    await CollectionFavorite.deleteMany({ collectionId });
    await CollectionShare.deleteMany({ collectionId });
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
    const coll = await Collection.findById(collectionId);

    if (!coll) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "존재하지 않습니다." });
    }

    // 생성자 & 공유자 확인
    const isOwner = coll.createdBy.toString() === user;
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

    const sharing = await CollectionShare.find({ collectionId })
      .populate("userId", "name email")
      .lean();

    return res.status(StatusCodes.OK).json(sharing);
  } catch (err) {
    next(err);
  }
};

// 공유 사용자 추가 및 메일 발송
const updateSharedUsers = async (req, res, next) => {
  const collectionId = req.params.collectionId;
  const createdBy = req.user.id;
  const { email, role } = req.body;

  try {
    const coll = await Collection.findOne({
      _id: collectionId,
      createdBy: createdBy,
    });

    if (!coll) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 유저가 없으면 새로 추가
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: "", role: "viewer" });
      await user.save();
    }

    // 본인에게 공유 시 에러
    if (user._id.toString() === coll.createdBy.toString()) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "본인에게 공유할 수 없습니다." }); // 추가
    }

    // 이미 공유되고 있는지 확인
    const existingUser = await CollectionShare.findOne({
      collectionId: collectionId,
      userId: user._id,
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
        userId: user._id,
        role: role,
      });
      await newShare.save();

      const [owner, invited] = await Promise.all([
        User.findById(coll.createdBy),
        User.findById(user._id),
      ]);

      const ownerName = owner?.name || "";
      const invitedName =
        invited?.name === "" ? email.split("@")[0] : invited?.name;
      const collectionName = coll.title;
      const link = `https://test.com/collections/${coll._id}`; // 수정 필요

      // 메일 발송
      try {
        await sendEmail(email, ownerName, invitedName, collectionName, link);
        res
          .status(StatusCodes.CREATED)
          .json({ message: "사용자 추가 및 메일 보내기 성공" });
      } catch (err) {
        res
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
    const coll = await Collection.findById(collectionId).lean();

    // 찾을 수 없거나 권한 없음
    if (!coll) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    // 생성자 & 공유자 확인
    const isOwner = coll.createdBy.toString() === user;
    const sharing = await CollectionShare.findOne({
      collectionId,
      userId,
    }).lean();
    const isSharedUser = sharing && sharing.userId.toString() === user;

    // 둘 다 아님
    if (!isOwner && !isSharedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
    }

    await CollectionFavorite.deleteOne({ collectionId, userId });
    await CollectionShare.deleteOne({ collectionId, userId });
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
