import OGImageCache from "../models/OGImageCache.js";
import ogs from "open-graph-scraper";

export const getOGImage = async (url) => {
  // 캐시에서 먼저 확인
  const cachedImage = await OGImageCache.findOne({url});

  // 캐시된 이미지가 있고, 생성된 지 7일 이내라면 캐시된 이미지 반환
  if (cachedImage && Date.now() - cachedImage.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return cachedImage.imageUrl;
  }

  try {
    const {result} = await ogs({url});
    const ogImageUrl = result.ogImage?.[0]?.url || null;

    // 캐시 업데이트 또는 새로 생성
    await OGImageCache.findOneAndUpdate(
      {url},
      {imageUrl: ogImageUrl, createdAt: new Date()}, // createdAt을 현재 시간으로 업데이트, TTL 갱신
      {upsert: true, new: true} // 없으면 생성, 있으면 업데이트
    );

    return ogImageUrl;
  } catch (err) {
    console.log(`OG Image fetch error (${url}):`, err.message);
    // 에러 발생 시에도 캐시에 null 또는 에러 상태를 저장하여 불필요 요청 방지
    await OGImageCache.findOneAndUpdate({url}, {imageUrl: null, createdAt: new Date()}, {upsert: true, new: true});
    return null;
  }
};

/*


async function getOGImage(url) {
  // 캐시에서 먼저 확인
  const cachedImage = await OGImageCache.findOne({url});

  // 캐시된 이미지가 있고, 생성된 지 7일 이내라면 캐시된 이미지 반환
  if (cachedImage && Date.now() - cachedImage.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return cachedImage.imageUrl;
  }

  try {
    const {result} = await ogs({url});
    const ogImageUrl = result.ogImage?.[0]?.url || null;

    // 캐시 업데이트 또는 새로 생성
    await OGImageCache.findOneAndUpdate(
      {url},
      {imageUrl: ogImageUrl, createdAt: new Date()}, // createdAt을 현재 시간으로 업데이트, TTL 갱신
      {upsert: true, new: true} // 없으면 생성, 있으면 업데이트
    );

    return ogImageUrl;
  } catch (err) {
    console.log(`OG Image fetch error (${url}):`, err.message);
    // 에러 발생 시에도 캐시에 null 또는 에러 상태를 저장하여 불필요 요청 방지
    await OGImageCache.findOneAndUpdate({url}, {imageUrl: null, createdAt: new Date()}, {upsert: true, new: true});
    return null;
  }
}
*/