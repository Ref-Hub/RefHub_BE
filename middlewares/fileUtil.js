import * as dotenv from "dotenv";

dotenv.config();

export const getFileUrl = (fileId) => {
    return `${process.env.BASE_URL}/api/references/file/${fileId}`;
  };