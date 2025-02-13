import * as dotenv from "dotenv";

dotenv.config();

export const getFileUrl = (fileId) => {
    return `https://refhub.my/api/references/file/${fileId}`;
  };
