/*
  네이버 블로그 꾸미기용 이미지를 그립니다. `node scripts/make-naver-assets.cjs`

  네이버 블로그는 티스토리처럼 HTML·CSS 로 스킨을 고치는 곳이 아니라서,
  이미지로 분위기를 맞춥니다(타이틀·커버). 글꼴은 이 PC 의 바탕·맑은 고딕입니다.

  규격은 개인 블로그 글에서 확인한 값입니다(공식 아님).
    타이틀   가로 966 고정, 세로 50~300
    커버     700x525 이상 (2배로 그려 선명하게)
    앱 커버  1080x1300 (세로 5:6). 가로 커버를 넣으면 양옆이 잘려 글자가 끊깁니다.
             앱이 아래쪽에 블로그명·프로필을 얹으므로 글자는 위쪽 절반에 둡니다.
*/
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const OUT = path.resolve(__dirname, '../blog/naver-assets');
fs.mkdirSync(OUT, { recursive: true });

const PAPER = '#fbfaf6';
const GRID = '#2e7d5b';
const GRID_DEEP = '#1f5a41';
const GRID_FAINT = '#b9d6c8';
const INK = '#232b33';
const INK_SOFT = '#656f7b';
const SERIF = 'Batang, BatangChe, Gowun Batang, serif';
const SANS = 'Malgun Gothic, Apple SD Gothic Neo, sans-serif';

function cell(x, y, size, ch, { fill = '#ffffff', stroke = GRID, text = INK } = {}) {
  const mid = x + size / 2;
  return `
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.07}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(2, size * 0.03)}"/>
  <line x1="${mid}" y1="${y}" x2="${mid}" y2="${y + size}" stroke="${GRID_FAINT}" stroke-width="1"/>
  <line x1="${x}" y1="${y + size / 2}" x2="${x + size}" y2="${y + size / 2}" stroke="${GRID_FAINT}" stroke-width="1"/>
  <text x="${mid}" y="${y + size * 0.74}" font-family="${SERIF}" font-size="${size * 0.66}" font-weight="700"
        fill="${text}" text-anchor="middle">${ch}</text>`;
}

/** 타이틀 966x200 — 티스토리 헤더의 「작」 칸 + 이름 */
function titleSvg() {
  const W = 966;
  const H = 200;
  const rules = [];
  for (let y = 40; y < H; y += 40) rules.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#efeadc" stroke-width="1"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${rules.join('\n  ')}
  <rect x="0" y="0" width="12" height="${H}" fill="${GRID}"/>
  ${cell(52, 54, 92, '작')}
  <text x="176" y="112" font-family="${SERIF}" font-size="64" font-weight="700" fill="${GRID_DEEP}">이여꾸의 작업실</text>
  <text x="180" y="156" font-family="${SANS}" font-size="24" fill="${INK_SOFT}">직접 만들고, 기록하면서 키웁니다</text>
</svg>`;
}

/** 커버 1400x1050 (700x525 의 2배) — 티스토리 글 머리 배너와 같은 초록 바탕 */
function coverSvg() {
  const W = 1400;
  const H = 1050;
  const lines = [];
  for (let x = 0; x <= W; x += 70) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>`);
  for (let y = 0; y <= H; y += 70) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRID_DEEP}"/>
      <stop offset="1" stop-color="${GRID}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${lines.join('\n  ')}
  <text x="140" y="370" font-family="${SERIF}" font-size="124" font-weight="700" fill="#ffffff">직접 만들고,</text>
  <text x="140" y="520" font-family="${SERIF}" font-size="124" font-weight="700" fill="#ffffff">기록하면서 키웁니다</text>
  <text x="144" y="620" font-family="${SANS}" font-size="46" fill="rgba(255,255,255,0.85)">초등 받아쓰기·맞춤법 앱 '받아쓰기 공책' 외</text>
  ${cell(140, 700, 130, '작', { fill: '#ffffff', stroke: '#ffffff' })}
  <text x="300" y="792" font-family="${SERIF}" font-size="70" font-weight="700" fill="#ffffff">이여꾸의 작업실</text>
</svg>`;
}

/** 앱 커버 1080x1300 — 가로 커버와 같은 초록 원고지, 글자는 위쪽에 */
function mobileCoverSvg() {
  const W = 1080;
  const H = 1300;
  const lines = [];
  for (let x = 0; x <= W; x += 60) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>`);
  for (let y = 0; y <= H; y += 60) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRID_DEEP}"/>
      <stop offset="1" stop-color="${GRID}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${lines.join('\n  ')}
  ${cell(W / 2 - 80, 170, 160, '작', { fill: '#ffffff', stroke: '#ffffff' })}
  <text x="${W / 2}" y="480" font-family="${SERIF}" font-size="96" font-weight="700" fill="#ffffff" text-anchor="middle">직접 만들고,</text>
  <text x="${W / 2}" y="600" font-family="${SERIF}" font-size="96" font-weight="700" fill="#ffffff" text-anchor="middle">기록하면서 키웁니다</text>
  <text x="${W / 2}" y="680" font-family="${SANS}" font-size="38" fill="rgba(255,255,255,0.85)" text-anchor="middle">초등 받아쓰기·맞춤법 앱 '받아쓰기 공책' 외</text>
</svg>`;
}

/**
 * 프로필 512x512 — 블로그의 얼굴은 「받아쓰기 공책」이 아니라 「작업실」입니다.
 * 받아쓰기 앱 아이콘(「받」)을 쓰면 블로그가 앱 하나의 공식 계정처럼 보입니다.
 * 사이드 프로젝트가 늘어도 어울리게 티스토리 로고의 「작」 칸을 그대로 씁니다.
 * 네이버·티스토리 프로필이 원형으로 잘려도 칸이 안 잘리게 여백을 넉넉히 둡니다.
 */
function profileSvg() {
  const S = 512;
  const size = 300;
  const x = (S - size) / 2;
  const y = (S - size) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <rect width="${S}" height="${S}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${S}" height="${S}" fill="none" stroke="${GRID_FAINT}" stroke-width="0"/>
  ${cell(x, y, size, '작')}
</svg>`;
}

/**
 * 프로필 512x512 — 아이디 「dldurrn」(이여꾸를 한글 자판 그대로 친 것)에 깜빡이는 커서.
 * 앱에서는 동그랗게 잘리므로 글자를 가운데 70% 안에 둡니다.
 */
function profileIdSvg() {
  const S = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <rect width="${S}" height="${S}" fill="${PAPER}"/>
  <text x="236" y="254" font-family="Consolas, Menlo, monospace" font-size="78" font-weight="700"
        fill="${GRID_DEEP}" text-anchor="middle">dldurrn</text>
  <rect x="402" y="190" width="10" height="78" fill="${GRID}"/>
  <text x="${S / 2}" y="324" font-family="${SERIF}" font-size="34" fill="${INK_SOFT}" text-anchor="middle">이여꾸의 작업실</text>
</svg>`;
}

(async () => {
  await sharp(Buffer.from(profileIdSvg())).png().toFile(path.join(OUT, 'profile-dldurrn-512.png'));
  await sharp(Buffer.from(titleSvg())).png().toFile(path.join(OUT, 'naver-title-966x200.png'));
  await sharp(Buffer.from(coverSvg())).png().toFile(path.join(OUT, 'naver-cover-1400x1050.png'));
  await sharp(Buffer.from(mobileCoverSvg())).png().toFile(path.join(OUT, 'naver-app-cover-1080x1300.png'));
  await sharp(Buffer.from(profileSvg())).png().toFile(path.join(OUT, 'profile-workshop-512.png'));
  console.log('만듦:', path.relative(process.cwd(), OUT));
})();
