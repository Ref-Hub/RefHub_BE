import { StatusCodes } from "http-status-codes";
import Collection from "../models/Collection.js";
import User from "../models/User.js";
import { createTransport } from "nodemailer";
import path from "path";
import ejs from "ejs";

const appDir = path.resolve();

const transporter = createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.GMAIL_OAUTH_USER,
    clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
    clientSecret: process.env.GAMIL_OAUTH_CLIENT_SECRET,
    refreshToken: process.env.GAMIL_OAUTH_REFRESH_TOKEN,
  },
});

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
    from: process.env.GMAIL_OAUTH_USER,
    to: email,
    subject: `📁RefHub📁 ${ownerName}님이 ${collectionName} 컬렉션에 초대했습니다.`,
    html: emailTemplate,
    attachments: [
      {
        filename: "logo.png",
        path: path.join(appDir, "src/templates", "logo.png"),
        cid: "logo",
      },
    ],
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email send successfully");
  } catch (err) {
    console.error("Email send failed", err);
    throw new Error("메일 발송 실패");
  }
};

const setPrivate = async (req, res, next) => {
  try {
    const coll = await Collection.findById(req.params.collectionId);

    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
      return;
    }

    coll.set("sharedWith", []);
    await coll.save();
    res.status(StatusCodes.OK).json(coll);
  } catch (err) {
    next(err);
  }
};

const getSharedUsers = async (req, res, next) => {
  try {
    const coll = await Collection.findById(req.params.collectionId).populate(
      "sharedWith.userId",
      "name email"
    );

    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
      return;
    }

    res.status(StatusCodes.OK).json(coll.sharedWith);
  } catch (err) {
    next(err);
  }
};

const updateSharedUsers = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const coll = await Collection.findById(req.params.collectionId);

    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
      return;
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({ email, name: "", role: "viewer" });
      await user.save();
    }

    if (user._id.toString() === coll.createdBy.toString()) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "본인에게 공유할 수 없습니다." }); // 추가
      return;
    }

    // 이미 공유되고 있는지 확인
    const existingUser = coll.sharedWith.find(
      (sharedUser) => sharedUser.userId.toString() === user._id.toString()
    );

    if (existingUser) {
      existingUser.role = role;
      await coll.save();
      res.status(StatusCodes.OK).json({ message: "사용자 수정 성공" });
    } else {
      coll.sharedWith.push({ userId: user?._id, role });
      await coll.save();

      const [owner, invited] = await Promise.all([
        User.findById(coll.createdBy),
        User.findById(user._id),
      ]);

      const ownerName = owner?.name || "";
      const invitedName =
        invited?.name === "" ? email.split("@")[0] : invited?.name;
      const collectionName = coll.title;
      const link = `https://refub.com/collections/${coll._id}`; // 수정 필요

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

const deleteSharedUser = async (req, res, next) => {
  try {
    const { collectionId, userId } = req.params;
    const coll = await Collection.findById(collectionId);
    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
      return;
    }

    const userIndex = coll.sharedWith.findIndex(
      (user) => user.userId.toString() === userId
    );

    if (userIndex === -1) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "존재하지 않습니다.",
      });
      return;
    }

    coll.sharedWith.splice(userIndex, 1);
    await coll.save();
    res.status(StatusCodes.OK).json({
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
