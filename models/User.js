import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    maxlength: 10,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  verificationCode: {
    type: Number,
    max: 999999
  },
  verificationExpires: {
    type: Date,
  },
  deleteRequestDate: {
    type: Date,
  },
  profileImage: {
    type: String,
  },
  provider: {
    type: String,
    enum: ['local', 'kakao'],
    default: 'local',
  },
},
{ versionKey: false }
);

const User = mongoose.model('User', userSchema);
export default User;
