'use client';

/**
 * 사진을 보내기 전에 브라우저에서 줄이고 JPEG로 바꿉니다.
 *
 * 왜 필요한가
 * 1. **Vercel은 요청 본문이 4.5MB를 넘으면 함수에 닿기도 전에 막습니다.**
 *    인프라 제한이라 서버 코드로는 못 늘립니다. 요즘 폰으로 찍으면 4~6MB가 흔히 나오는데,
 *    그대로 보내면 우리 라우트는 실행조차 되지 않고 화면에는 "연결을 확인해 주세요"만 뜹니다.
 *    연결 문제가 아닌데 연결을 탓하게 됩니다.
 * 2. **아이폰 기본 형식(HEIC)을 Anthropic이 받지 않습니다.**
 *    캔버스를 거치면 무조건 JPEG로 나오므로 이 문제가 함께 사라집니다.
 * 3. Anthropic도 어차피 긴 변을 1568px로 줄여서 처리합니다.
 *    미리 줄여도 인식 품질은 그대로면서 업로드만 빨라집니다.
 *
 * EXIF 회전 정보를 반영합니다(`imageOrientation: 'from-image'`).
 * 폰으로 찍은 사진은 눕혀 저장되는 경우가 많은데, 그대로 보내면 글자가 옆으로 누워
 * 인식률이 크게 떨어집니다.
 */

/** 긴 변 기준 목표 크기. Anthropic이 내부적으로 쓰는 1568px보다 살짝 크게 잡아 여유를 둡니다. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export class ImageDecodeError extends Error {}

export async function prepareImageForUpload(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // 크롬·엣지는 HEIC를 아예 디코딩하지 못합니다. 그때 여기로 옵니다.
    throw new ImageDecodeError('이 사진 형식을 읽지 못했어요.');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new ImageDecodeError('사진을 처리하지 못했어요.');
  }

  // 문제지는 흰 종이라 흰 바탕을 깔아 둡니다.
  // 투명한 부분이 있는 이미지가 들어와도 검게 나오지 않습니다.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new ImageDecodeError('사진을 처리하지 못했어요.');

  return new File([blob], 'worksheet.jpg', { type: 'image/jpeg' });
}
