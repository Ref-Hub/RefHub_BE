// 컬렉션 코드 작성을 위해 임의로 작성
import mongoose from "mongoose";

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

const User = mongoose.model("User", userSchema, "users");
export default User;
