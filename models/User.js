"use strict";
// 컬렉션 코드 작성을 위해 임의로 작성

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
    },
  },
  { versionKey: false }
);

module.exports = mongoose.model("User", userSchema, "users");
