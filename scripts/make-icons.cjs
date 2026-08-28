/*
  앱 아이콘·공유 카드를 그립니다. `node scripts/make-icons.cjs`

  한 번 돌려 결과물을 저장소에 넣어 두는 스크립트입니다. 빌드 때 돌지 않습니다 —
  Vercel에서 그리면 한글 글꼴이 없어 「받」이 네모로 나옵니다.
  sharp는 next가 딸려 오면서 들어온 것이라, 없으면 `npm i -D sharp` 하고 돌리세요.

  소재는 원고지 한 칸입니다. 앱을 여는 아이콘과 앱을 열었을 때 보는 것이 같아야
  홈 화면에서 무엇인지 알아봅니다.
*/
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const PAPER = '#fbfaf6';
const GRID = '#2e7d5b';
const GRID_FAINT = '#b9d6c8';
const INK = '#232b33';
const INK_SOFT = '#656f7b';

/** 명조입니다. 앱의 표제(.display)와 같은 결이라야 같은 물건으로 보입니다. */
const SERIF = 'Batang, BatangChe, Gowun Batang, Nanum Myeongjo, serif';

/**
 * 원고지 칸 하나.
 * @param inset 칸이 아이콘 테두리에서 얼마나 안쪽인가. 마스크(원형)로 잘리는 안드로이드용은 크게 줍니다.
 */
function cell(size, inset, { ground = PAPER } = {}) {
  const x = inset;
  const w = size - inset * 2;
  const mid = x + w / 2;
  const stroke = Math.max(2, size * 0.018);
  const hair = Math.max(1, size * 0.007);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${ground}"/>
  <rect x="${x}" y="${x}" width="${w}" height="${w}" rx="${w * 0.06}"
        fill="none" stroke="${GRID}" stroke-width="${stroke}"/>
  <line x1="${mid}" y1="${x}" x2="${mid}" y2="${x + w}" stroke="${GRID_FAINT}" stroke-width="${hair}"/>
  <line x1="${x}" y1="${mid}" x2="${x + w}" y2="${mid}" stroke="${GRID_FAINT}" stroke-width="${hair}"/>
  <text x="${mid}" y="${mid + w * 0.265}" font-family="${SERIF}" font-size="${w * 0.68}"
        font-weight="700" fill="${INK}" text-anchor="middle">받</text>
</svg>`;
}

/** 카톡·문자에 붙였을 때 뜨는 카드. 1200x630. */
function card() {
  const W = 1200;
  const H = 630;
  const cellW = 132;
  const gap = 10;
  const startX = 150;
  const y = 250;

  // 「받아쓰기」 다섯 글자를 실제 원고지처럼 칸에 하나씩 앉힙니다.
  const chars = ['받', '아', '쓰', '기'];
  const cells = chars
    .map((ch, i) => {
      const x = startX + i * (cellW + gap);
      const mid = x + cellW / 2;
      const midY = y + cellW / 2;
      return `
    <rect x="${x}" y="${y}" width="${cellW}" height="${cellW}" rx="7"
          fill="#ffffff" stroke="${GRID}" stroke-width="2.5"/>
    <line x1="${mid}" y1="${y}" x2="${mid}" y2="${y + cellW}" stroke="${GRID_FAINT}" stroke-width="1"/>
    <line x1="${x}" y1="${midY}" x2="${x + cellW}" y2="${midY}" stroke="${GRID_FAINT}" stroke-width="1"/>
    <text x="${mid}" y="${midY + cellW * 0.29}" font-family="${SERIF}" font-size="${cellW * 0.72}"
          font-weight="700" fill="${INK}" text-anchor="middle">${ch}</text>`;
    })
    .join('');

  // 다섯째 칸은 비워 둡니다 — 아직 쓰는 중이라는 뜻이고, 커서가 깜빡이는 자리입니다.
  const emptyX = startX + 4 * (cellW + gap);
  const emptyMid = emptyX + cellW / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${W}" height="10" fill="${GRID}"/>
  <text x="${startX}" y="185" font-family="${SERIF}" font-size="46" font-weight="700" fill="${GRID}">받아쓰기 공책</text>
  ${cells}
    <rect x="${emptyX}" y="${y}" width="${cellW}" height="${cellW}" rx="7"
          fill="#ffffff" stroke="${GRID}" stroke-width="2.5"/>
    <line x1="${emptyMid}" y1="${y}" x2="${emptyMid}" y2="${y + cellW}" stroke="${GRID_FAINT}" stroke-width="1"/>
    <line x1="${emptyX}" y1="${y + cellW / 2}" x2="${emptyX + cellW}" y2="${y + cellW / 2}" stroke="${GRID_FAINT}" stroke-width="1"/>
    <rect x="${emptyMid - 3}" y="${y + 22}" width="6" height="${cellW - 44}" rx="3" fill="${GRID}" opacity="0.35"/>
  <text x="${startX}" y="490" font-family="Malgun Gothic, sans-serif" font-size="34" fill="${INK_SOFT}">듣고 쓰면, 틀린 곳을 한 글자씩 짚어 줘요</text>
  <text x="${startX}" y="545" font-family="Malgun Gothic, sans-serif" font-size="26" fill="#98a1ac">초등 저학년 받아쓰기 · 맞춤법</text>
</svg>`;
}

const out = (...p) => path.join(__dirname, '..', ...p);
fs.mkdirSync(out('public'), { recursive: true });

const jobs = [
  // 브라우저 탭·PC. Next 가 src/app 의 것을 자동으로 걸어 줍니다.
  ['src/app/icon.png', cell(512, 34), 512],
  // iOS 홈 화면. 애플이 알아서 모서리를 깎으므로 우리는 각지게 두고 여백만 넉넉히.
  ['src/app/apple-icon.png', cell(180, 14), 180],
  // 안드로이드 홈 화면(manifest). maskable 은 원으로 잘려도 「받」이 살아남게 크게 물립니다.
  ['public/icon-192.png', cell(192, 13), 192],
  ['public/icon-512.png', cell(512, 34), 512],
  ['public/icon-maskable-512.png', cell(512, 96), 512],
];

(async () => {
  for (const [file, svg, size] of jobs) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out(file));
    console.log('그림:', file);
  }
  await sharp(Buffer.from(card())).png().toFile(out('src/app/opengraph-image.png'));
  console.log('그림: src/app/opengraph-image.png');
})();
