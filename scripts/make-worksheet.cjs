/*
  촬영용 받아쓰기 문제지를 그립니다. `node scripts/make-worksheet.cjs`
  결과: insta/worksheet/문제지_<N>급.png (A4 · 300dpi, 그대로 인쇄)

  「사진으로 문제 넣기」 릴스를 찍으려면 사진 찍을 종이가 있어야 합니다.
  **실제 학교 문제지는 쓰지 않습니다** — 학교 이름·아이 이름·선생님 필체가 찍히고,
  원문에는 저작권이 있습니다. 그래서 우리 문제은행 문장으로 학교 문제지처럼 그립니다.

  학교 문제지는 원고지라 칸마다 한 글자씩 앉힙니다. 앱이 사진과 원고지를
  나란히 놓고 대조하는 화면(SetForm)과도 모양이 맞아, 영상에서 한눈에 이어집니다.

  **문장 말고는 글자를 거의 두지 않습니다.** 사진 인식(/api/ocr)은
  「번호는 빼고 문장만」 뽑는 규칙이라, 「이름 ( )」 같은 칸을 두면
  그게 문장으로 딸려 들어올 수 있습니다. 촬영 도중 그러면 다시 찍어야 합니다.
  번호는 괜찮습니다 — 규칙이 뺍니다.

  「단계」가 아니라 「급」이라고 적는 것은 일부러입니다. 앱은 학교 것과 헷갈리지 않게
  「단계」를 쓰지만, 이 종이는 **학교 문제지 역할**을 하는 소품입니다.
*/
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { GRID, INK, INK_SOFT, SANS, SERIF, esc } = require('./make-cards.cjs');

// A4 · 300dpi
const W = 2480;
const H = 3508;
const MARGIN = 200;
const NUM_COL = 140; // 문제 번호 자리
const COLS = 15; // 원고지 한 줄 — 앱과 같은 15칸
const CELL = Math.floor((W - MARGIN * 2 - NUM_COL) / COLS);
const ROW_GAP = 100;
const TOP = 720;

/* ---------------- 받아쓰기 문제은행 읽기 ---------------- */
function loadLevel(id) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/data/dictation-bank.ts'), 'utf8');
  const start = src.indexOf(`id: '${id}'`);
  if (start < 0) throw new Error('단계를 못 찾았습니다: ' + id);
  const next = src.indexOf("id: 'lv", start + 10);
  const block = src.slice(start, next < 0 ? undefined : next);
  const arr = block.slice(block.indexOf('['), block.indexOf(']') + 1);
  return [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/**
 * 문장을 원고지 칸으로. 글자 하나에 칸 하나, 띄어쓰기는 빈 칸.
 * 원고지 규칙대로 쉼표 뒤 공백은 칸을 차지하지 않습니다(앱의 toCells 와 같은 규칙).
 */
function toCells(sentence) {
  const chars = [...sentence];
  const cells = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ' && (chars[i - 1] === ',' || chars[i - 1] === '.')) continue;
    cells.push(ch === ' ' ? '' : ch);
  }
  if (cells.length > COLS) throw new Error(`15칸을 넘습니다: ${sentence}`);
  return cells;
}

/** 원고지에서 마침표·쉼표는 칸의 왼쪽 아래에 찍습니다. 가운데 두면 글자처럼 보입니다. */
const LOW_MARKS = new Set(['.', ',']);

function row(n, sentence, y) {
  const x0 = MARGIN + NUM_COL;
  const cells = toCells(sentence);
  let out = `
  <text x="${MARGIN + NUM_COL / 2}" y="${y + CELL * 0.66}" font-family="${SANS}" font-size="64"
        font-weight="700" fill="${INK_SOFT}" text-anchor="middle">${n}</text>
  <rect x="${x0}" y="${y}" width="${CELL * COLS}" height="${CELL}" fill="#ffffff"
        stroke="${GRID}" stroke-width="4"/>`;
  for (let c = 1; c < COLS; c++) {
    out += `<line x1="${x0 + c * CELL}" y1="${y}" x2="${x0 + c * CELL}" y2="${y + CELL}"
            stroke="${GRID}" stroke-width="2.5" opacity="0.7"/>`;
  }
  cells.forEach((ch, c) => {
    if (!ch) return;
    const low = LOW_MARKS.has(ch);
    const cx = x0 + c * CELL + (low ? CELL * 0.3 : CELL / 2);
    const cy = y + (low ? CELL * 0.86 : CELL * 0.72);
    out += `<text x="${cx}" y="${cy}" font-family="${SANS}" font-size="${Math.round(CELL * 0.66)}"
            fill="${INK}" text-anchor="middle">${esc(ch)}</text>`;
  });
  return out;
}

function sheet(grade, sentences) {
  const rows = sentences.map((s, i) => row(i + 1, s, TOP + i * (CELL + ROW_GAP))).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${MARGIN}" y="400" font-family="${SERIF}" font-size="128" font-weight="700"
        fill="${INK}">받아쓰기</text>
  <text x="${W - MARGIN}" y="400" font-family="${SANS}" font-size="72" font-weight="700"
        fill="${GRID}" text-anchor="end">${esc(grade)}</text>
  <line x1="${MARGIN}" y1="500" x2="${W - MARGIN}" y2="500" stroke="${GRID}" stroke-width="6"/>
  ${rows}
</svg>`;
}

/*
  14단계가 주 문제지입니다 — 원인과 결과가 있는 온전한 문장이고 받침(먹었어요·썼어요)이 많아
  「사진이 문장이 되는」 장면이 볼만합니다. 1번이 정확히 15자라 한 줄을 꽉 채웁니다.
  17단계는 예비입니다 — 짧아서 사진이 잘 안 읽힐 때 바꿔 찍습니다.
*/
const SHEETS = [
  { id: 'lv14', grade: '14급' },
  { id: 'lv17', grade: '17급' },
];

(async () => {
  const dir = path.join(__dirname, '..', 'insta', 'worksheet');
  fs.mkdirSync(dir, { recursive: true });
  for (const { id, grade } of SHEETS) {
    const sentences = loadLevel(id).slice(0, 10);
    const file = path.join(dir, `문제지_${grade}.png`);
    // density 를 적어 두면 인쇄 대화상자가 A4 크기로 알아봅니다.
    await sharp(Buffer.from(sheet(grade, sentences)))
      .withMetadata({ density: 300 })
      .png()
      .toFile(file);
    console.log(`${grade}  ${sentences.length}문장 → ${path.relative(process.cwd(), file)}`);
  }
})();
