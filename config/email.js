import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export const smtpTransport = nodemailer.createTransport({
  service: 'gmail',
  port: 587,
  secure: false,
  auth: {
    user: process.env.USER,
    pass: process.env.PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});