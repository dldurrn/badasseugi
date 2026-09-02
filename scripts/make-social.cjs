/*
  인스타그램용 이미지. `node scripts/make-social.cjs`

  아이콘과 같은 소재를 씁니다 — 원고지 한 칸에 「받」.
  홈 화면 아이콘과 프로필 사진이 같아야 「그 앱이구나」가 됩니다.

  Vercel 에는 한글 글꼴이 없으므로 여기서 그려 결과물을 저장소에 넣습니다.
  (make-icons.cjs 와 같은 이유)
*/
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const PAPER = '#fbfaf6';
const GRID = '#2e7d5b';
const GRID_FAINT = '#b9d6c8';
const INK = '#232b33';
const INK_SOFT = '#656f7b';
const PEN = '#d8402f';

const SERIF = 'Batang, BatangChe, Gowun Batang, Nanum Myeongjo, serif';
const SANS = 'Malgun Gothic, sans-serif';

/**
 * 프로필 사진 — 인스타는 **원으로 잘라** 보여 줍니다.
 * 네 귀퉁이가 잘리므로 안쪽 원 안에 다 들어가게 둡니다.
 * 320 원에 들어가는 정사각형은 한 변 226 이라, 칸을 그보다 작게 잡습니다.
 */
function profile(size = 320) {
  const cell = Math.round(size * 0.52); // 166 — 원 안에 넉넉히
  const x = (size - cell) / 2;
  const mid = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <rect x="${x}" y="${x}" width="${cell}" height="${cell}" rx="${cell * 0.06}"
        fill="none" stroke="${GRID}" stroke-width="${size * 0.019}"/>
  <line x1="${mid}" y1="${x}" x2="${mid}" y2="${x + cell}" stroke="${GRID_FAINT}" stroke-width="${size * 0.007}"/>
  <line x1="${x}" y1="${mid}" x2="${x + cell}" y2="${mid}" stroke="${GRID_FAINT}" stroke-width="${size * 0.007}"/>
  <text x="${mid}" y="${mid + cell * 0.265}" font-family="${SERIF}" font-size="${cell * 0.68}"
        font-weight="700" fill="${INK}" text-anchor="middle">받</text>
</svg>`;
}

/**
 * 대표 게시물 — 채점표 한 장.
 *
 * 이 앱에서 **말로 설명할 필요가 없는 유일한 것**입니다.
 * 「자」가 「작」 위에, 「근」이 「은」 위에, 그 사이에 ∨.
 * 스크린샷이 아니라 그림입니다 — 화면인 척하지 않습니다.
 */
function gradeCard(size = 1080) {
  const 위 = ['자', '근', '∨', '발', '자', '국'];
  const 아 = ['작', '은', '', '발', '자', '국'];
  const 틀림 = [true, true, true, false, false, false];

  const w = 132;
  const gap = 8;
  const startX = (size - (w * 6 + gap * 5)) / 2;
  const y1 = 430;
  const y2 = y1 + w + 16;

  const 칸 = (ch, i, y, 정답줄) => {
    const x = startX + i * (w + gap);
    const bad = 틀림[i];
    const 글자색 = 정답줄 ? GRID : bad ? PEN : INK;
    const 배경 = bad ? (정답줄 ? '#eaf3ee' : '#fcecea') : '#ffffff';
    const 테 = bad ? (정답줄 ? GRID : PEN) : '#e6e2d6';
    return `
    <rect x="${x}" y="${y}" width="${w}" height="${w}" rx="8" fill="${배경}" stroke="${테}" stroke-width="2.5"/>
    <text x="${x + w / 2}" y="${y + w * 0.7}" font-family="${SERIF}" font-size="${w * 0.6}"
          font-weight="${bad ? 700 : 400}" fill="${글자색}" text-anchor="middle">${ch}</text>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${size}" height="12" fill="${GRID}"/>

  <text x="${size / 2}" y="200" font-family="${SERIF}" font-size="62" font-weight="700"
        fill="${INK}" text-anchor="middle">어디서 틀렸는지</text>
  <text x="${size / 2}" y="280" font-family="${SERIF}" font-size="62" font-weight="700"
        fill="${GRID}" text-anchor="middle">칸으로 짚어 줘요</text>

  <text x="${startX}" y="400" font-family="${SANS}" font-size="26" fill="${INK_SOFT}">윗줄 · 우리 아이가 쓴 것</text>
  ${위.map((ch, i) => 칸(ch, i, y1, false)).join('')}
  ${아.map((ch, i) => 칸(ch, i, y2, true)).join('')}
  <text x="${startX}" y="${y2 + w + 46}" font-family="${SANS}" font-size="26" fill="${GRID}">아랫줄 · 정답</text>

  <text x="${size / 2}" y="820" font-family="${SANS}" font-size="34" fill="${INK_SOFT}" text-anchor="middle">받침도, 띄어쓰기도 한 눈에</text>
  <text x="${size / 2}" y="960" font-family="${SERIF}" font-size="36" font-weight="700" fill="${GRID}" text-anchor="middle">받아쓰기 공책</text>
</svg>`;
}

const out = (...p) => path.join(__dirname, '..', ...p);
fs.mkdirSync(out('marketing'), { recursive: true });

(async () => {
  const jobs = [
    ['marketing/insta-profile.png', profile(320)],
    ['marketing/insta-post-gradesheet.png', gradeCard(1080)],
  ];
  for (const [file, svg] of jobs) {
    await sharp(Buffer.from(svg)).png().toFile(out(file));
    console.log('그림:', file);
  }
})();
