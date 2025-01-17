"use strict";
const { StatusCodes } = require("http-status-codes");
const Collection = require("../models/Collection");
const User = require("../models/User");
const { createTransport } = require("nodemailer");
const config = require("../config");

const duplicate = (err, req, res, next) => {
  console.error("Error: ", err);
  res.status(StatusCodes.BAD_REQUEST).json({
    message: "중복된 이름입니다.",
  });
};

const exceedMaxLength = (err, req, res, next) => {
  console.error("Error: ", err);
  res.status(StatusCodes.BAD_REQUEST).json({
    message: "20자 이내로 작성해주세요.",
  });
};

const notFound = (err, req, res, next) => {
  console.error("Error: ", err);
  res.status(StatusCodes.NOT_FOUND).json({
    message: "찾을 수 없습니다.",
  });
};

const transporter = createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: config.mailer.gmailUser,
    clientId: config.mailer.gmailClientId,
    clientSecret: config.mailer.gmailClientSecret,
    refreshToken: config.mailer.gmailRefreshToken,
  },
});

const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: "Refhub-account@gmail.com",
    to: to,
    subject: subject,
    text: text,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email send successfully");
  } catch (err) {
    console.error("Error sending email", err);
  }
};

const setPrivate = async (req, res, next) => {
  try {
    const coll = await Collection.findById(req.params.collectionId);
    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).send("Collection not found");
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
      res.status(StatusCodes.NOT_FOUND).send("Collection not found");
      return;
    }
    res.status(StatusCodes.OK).json(coll.sharedWith);
  } catch (err) {
    next(err);
  }
};

const setSharedUsers = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const coll = await Collection.findById(req.params.collectionId);
    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).send("Collection not found");
      return;
    }
    // User 컬렉션으로 바꿔야 함
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: "", role: "viewer" });
      await user.save();
    }
    // 이미 공유되고 있는지 확인
    const existingUser = coll.sharedWith.find(
      (sharedUser) => sharedUser.userId.toString() === user._id.toString()
    );
    if (existingUser) {
      existingUser.role = role;
      console.log();
      await coll.save();
      res.status(StatusCodes.OK).json("사용자 수정 성공");
    } else {
      coll.sharedWith.push({ userId: user ? user._id : null, role });
      await coll.save();
      next();
    }
  } catch (err) {
    next(err);
  }
};

const sendUsers = async (req, res, next) => {
  try {
    const to = req.body.email;
    const subject = "Welcome to RefHub!";
    const text = "Hello, welcome to our service";
    await sendEmail(to, subject, text);
    res.status(StatusCodes.CREATED).json("사용자 추가 및 메일 보내기 성공");
  } catch (err) {
    next(err);
  }
};

const removeSharedUser = async (req, res, next) => {
  try {
    const { collectionId, userId } = req.params;
    const coll = await Collection.findById(collectionId);
    if (!coll) {
      res.status(StatusCodes.NOT_FOUND).send("Collection not found");
      return;
    }
    coll.set(
      "sharedWith",
      await coll.sharedWith.filter((user) => user.userId.toString() !== userId)
    );
    await coll.save();
    res.status(StatusCodes.OK).json({
      message: "사용자 삭제 완료",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  setPrivate,
  getSharedUsers,
  setSharedUsers,
  sendUsers,
  removeSharedUser,
};
