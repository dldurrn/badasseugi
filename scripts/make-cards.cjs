/*
  인스타그램 카드를 그립니다. `node scripts/make-cards.cjs`

  맞춤법 문제은행(src/data/spelling-bank.ts)의 문항을 그대로 카드 3장으로 만듭니다.
  문제 → 정답 → 왜 그런지. 캐러셀 한 게시물이 곧 문항 하나입니다.

  손으로 다시 쓰지 않는 것이 요점입니다. 앱에 든 문항이 그대로 소재라
  카드 문구를 따로 관리하면 두 벌이 되고, 언젠가 앱과 인스타의 설명이 달라집니다.

  make-icons.cjs와 같은 방식(SVG → sharp)입니다. Vercel에는 한글 글꼴이 없으므로
  이 PC에서 돌려 결과물을 씁니다. 빌드에 끼워 넣지 마세요.
*/
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

/* ---------- 앱과 같은 색. globals.css가 단일 출처라 여기 값을 바꾸지 마세요 ---------- */
const PAPER = '#fbfaf6';
const PAPER_SUNK = '#f4f1e7';
const INK = '#232b33';
const INK_SOFT = '#656f7b';
const INK_FAINT = '#98a1ac';
const GRID = '#2e7d5b';
const GRID_DEEP = '#1f5a41';
const GRID_FAINT = '#b9d6c8';
const GRID_TINT = '#eaf3ee';
const PEN = '#d8402f';
const PEN_TINT = '#fceceA';

const SERIF = 'Batang, BatangChe, Gowun Batang, Nanum Myeongjo, serif';
const SANS = 'Malgun Gothic, Pretendard, sans-serif';

/** 인스타 세로 4:5. 정사각형보다 화면을 많이 차지해 그만큼 오래 붙잡습니다. */
const W = 1080;
const H = 1350;
const PAD = 84;

/* ---------- 글자 폭 어림 ---------- */
/* SVG에는 자동 줄바꿈이 없어 직접 재야 합니다. 한글은 정사각형에 가깝고
   로마자·숫자는 그 절반쯤입니다. 조금 넉넉히 잡아 잘리는 쪽을 막습니다. */
function widthOf(text, size) {
  let w = 0;
  for (const ch of text) {
    if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(ch)) w += 1.0;
    else if (ch === ' ') w += 0.34;
    else if (/[.,?!'"·]/.test(ch)) w += 0.42;
    else w += 0.55;
  }
  return w * size;
}

/** 폭에 맞춰 어절 단위로 줄을 나눕니다. */
function wrap(text, size, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? cur + ' ' + word : word;
    if (widthOf(next, size) > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- 조각 ---------- */

/**
 * 아주 옅은 원고지 격자를 바탕에 깝니다.
 * 빈 곳을 메우려는 것이 아니라, 인스타 피드에서 한 장만 스쳐 지나가도
 * 「국어 공책」으로 읽히게 하려는 것입니다 — 이 앱의 시그니처가 격자라서요.
 * 글자를 방해하면 안 되므로 아주 흐리게(0.05) 둡니다.
 */
function backdrop() {
  const s = 108;
  let out = '';
  for (let x = 0; x <= W; x += s) out += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 0; y <= H; y += s) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  return `<g stroke="${GRID}" stroke-width="1.5" opacity="0.05">${out}</g>`;
}

/** 종이 바탕 + 위쪽 초록 띠 + 아래 계정 표시. 세 장이 한 물건으로 보이게 합니다. */
function frame(inner, { footer = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${backdrop()}
  <rect x="0" y="0" width="${W}" height="14" fill="${GRID}"/>
  ${inner}
  ${
    footer
      ? `<text x="${W / 2}" y="${H - 62}" font-family="${SANS}" font-size="30"
             fill="${INK_FAINT}" text-anchor="middle">@badasseugi_note · 받아쓰기 공책</text>`
      : ''
  }
</svg>`;
}

/** 원고지 칸 하나. 이 앱의 시그니처라 카드마다 한 번은 나옵니다. */
function cell(x, y, size, ch, { color = INK, ground = '#ffffff', dash = false } = {}) {
  const mid = x + size / 2;
  const midY = y + size / 2;
  return `
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.06}"
        fill="${ground}" stroke="${GRID}" stroke-width="${size * 0.028}"
        ${dash ? `stroke-dasharray="${size * 0.09} ${size * 0.07}"` : ''}/>
  <line x1="${mid}" y1="${y}" x2="${mid}" y2="${y + size}" stroke="${GRID_FAINT}" stroke-width="${size * 0.012}"/>
  <line x1="${x}" y1="${midY}" x2="${x + size}" y2="${midY}" stroke="${GRID_FAINT}" stroke-width="${size * 0.012}"/>
  ${
    ch
      ? `<text x="${mid}" y="${midY + size * 0.29}" font-family="${SERIF}" font-size="${size * 0.72}"
              font-weight="700" fill="${color}" text-anchor="middle">${esc(ch)}</text>`
      : ''
  }`;
}

/** 위쪽 꼬리표. 무엇에 대한 문제인지 한눈에 — 저장해 두고 나중에 찾을 때 씁니다. */
function label(text) {
  const w = widthOf(text, 30) + 56;
  return `
  <rect x="${PAD}" y="120" width="${w}" height="60" rx="30" fill="${GRID_TINT}"/>
  <text x="${PAD + 28}" y="161" font-family="${SANS}" font-size="30" font-weight="700"
        fill="${GRID_DEEP}">${esc(text)}</text>`;
}

/** 가운데 정렬 여러 줄. y는 첫 줄의 기준선입니다. */
function lines(text, { y, size, gap, color = INK, font = SERIF, weight = 400, maxW = W - PAD * 2 }) {
  return wrap(text, size, maxW)
    .map(
      (ln, i) =>
        `<text x="${W / 2}" y="${y + i * gap}" font-family="${font}" font-size="${size}"
              font-weight="${weight}" fill="${color}" text-anchor="middle">${esc(ln)}</text>`,
    )
    .join('');
}
function lineCount(text, size, maxW = W - PAD * 2) {
  return wrap(text, size, maxW).length;
}

/* =========================================================================
   여기서부터 실제 카드. 문제 → 정답 → 왜. 세 장이 캐러셀 한 게시물입니다.
   ========================================================================= */

/**
 * 한 줄을 조각으로 이어 붙여 가운데에 놓습니다.
 * 조각은 글(text)이거나 원고지 칸(cell)입니다 — 빈칸을 칸으로 그려야
 * 「여기에 뭘 쓰지?」가 그림으로 읽힙니다.
 * 폭이 넘치면 글자를 줄입니다. 문장 길이가 문항마다 달라서 한 크기로 못 박으면
 * 긴 문장이 잘립니다 — 잘린 문제는 문제가 아닙니다.
 */
function runs(segs, { y, size, maxW = W - PAD * 2, min = 34 }) {
  // 칸은 글자 하나에 하나입니다. 원고지가 그렇고, 앱도 그렇습니다.
  // 두 글자를 한 칸에 몰아넣으면 「며칠」이 칸 밖으로 삐져나옵니다.
  const cellsOf = (g) => Math.max(1, [...(g.text || '')].length || g.slots || 1);
  let s = size;
  const measure = (fs) =>
    segs.reduce((a, g) => a + (g.cell ? fs * 1.18 * cellsOf(g) : widthOf(g.text, fs)), 0);
  while (measure(s) > maxW && s > min) s -= 2;

  let x = (W - measure(s)) / 2;
  let out = '';
  for (const g of segs) {
    if (g.cell) {
      const cw = s * 1.18;
      const chars = [...(g.text || '')];
      const n = cellsOf(g);
      for (let i = 0; i < n; i++) {
        out += cell(x, y - cw * 0.78, cw, chars[i] || '', {
          color: g.color || GRID_DEEP,
          ground: g.ground || '#ffffff',
        });
        x += cw;
      }
    } else {
      /*
        xml:space="preserve" 가 없으면 앞뒤 공백이 잘립니다.
        「꽃밭에 ___ 무엇을 보니?」의 빈칸 뒤 공백이 사라져 **칸과 「무엇을」이 붙었습니다** —
        폭은 이미 공백까지 재어 자리를 비워 두었는데 글자만 왼쪽으로 당겨져,
        띄어 쓴 문장이 붙여 쓴 것처럼 보였습니다.
      */
      out += `<text x="${x}" y="${y}" xml:space="preserve" font-family="${SERIF}" font-size="${s}"
              font-weight="${g.bold ? 700 : 400}" fill="${g.color || INK}">${esc(g.text)}</text>`;
      x += widthOf(g.text, s);
    }
  }
  return { svg: out, size: s };
}

/** 보기 상자. 앱의 고르기 버튼과 같은 모양이라야 앱을 열었을 때 낯설지 않습니다. */
function choiceRow(options, y, { mark } = {}) {
  const n = options.length;
  const gap = 24;
  const bw = Math.min(300, (W - PAD * 2 - gap * (n - 1)) / n);
  const bh = 118;
  const total = bw * n + gap * (n - 1);
  let x = (W - total) / 2;
  let out = '';
  for (const op of options) {
    const right = mark && op === mark.answer;
    const wrong = mark && op !== mark.answer;
    const fill = !mark ? '#ffffff' : right ? GRID_TINT : PEN_TINT;
    const stroke = !mark ? INK_FAINT : right ? GRID : PEN;
    let fs = 54;
    while (widthOf(op, fs) > bw - 36 && fs > 26) fs -= 2;
    out += `
    <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="20"
          fill="${fill}" stroke="${stroke}" stroke-width="${mark ? 4 : 3}"/>
    <text x="${x + bw / 2}" y="${y + bh / 2 + fs * 0.36}" font-family="${SERIF}" font-size="${fs}"
          font-weight="700" fill="${!mark ? INK : right ? GRID_DEEP : INK_SOFT}"
          text-anchor="middle">${esc(op)}</text>`;
    if (wrong) {
      // 글자 폭은 어림이라 딱 맞출 수 없습니다. 상자 기준으로 그으면 언제나 가운데입니다.
      const lw = bw - 64;
      out += `<line x1="${x + (bw - lw) / 2}" y1="${y + bh / 2 + 4}" x2="${x + (bw + lw) / 2}" y2="${y + bh / 2 + 4}"
              stroke="${PEN}" stroke-width="6" stroke-linecap="round"/>`;
    }
    x += bw + gap;
  }
  return out;
}

/*
  꼬리표가 정답을 흘리는 수가 있습니다 — 「며칠」 문항의 태그가 「며칠」이라
  문제를 보기도 전에 답이 위에 적혀 있었습니다.
  보기 안에 태그가 그대로 들어 있으면 문제 장에서만 일반 이름으로 바꿉니다.
  정답 장·설명 장에는 그대로 두어야 나중에 찾아볼 때 무엇에 대한 문항인지 압니다.
*/
function safeLabel(q) {
  // 「왠/웬」처럼 태그가 보기를 다 담고 있으면 어느 쪽이 답인지 알려 주지 않습니다.
  // 흘리는 것은 정답만 있고 틀린 보기는 빠졌을 때입니다 — 「며칠」이 그랬습니다.
  const wrongs = q.options.filter((op) => op !== q.answer);
  const spoils = q.tag.includes(q.answer) && !wrongs.every((op) => q.tag.includes(op));
  return label(spoils ? '맞춤법 한 문제' : q.tag);
}

/* ---------------- 1장: 문제 ---------------- */
function cardQuestion(q) {
  let body;
  if (q.kind === 'find') {
    body = runs([{ text: q.prompt }], { y: 640, size: 64 }).svg;
  } else {
    const [before, after] = q.prompt.split('___');
    // 빈칸도 정답 글자 수만큼 그립니다. 원고지에서 칸 수는 이미 힌트이고,
    // 다음 장의 정답과 자리가 맞아떨어져야 눈이 같은 곳을 봅니다.
    body = runs(
      [{ text: before }, { cell: true, text: '', slots: [...q.answer].length }, { text: after }],
      { y: 620, size: 62 },
    ).svg;
  }
  const ask = q.kind === 'find' ? '틀린 곳은 어디일까요?' : '빈칸에 들어갈 말은?';
  return frame(`
  ${safeLabel(q)}
  <text x="${W / 2}" y="430" font-family="${SANS}" font-size="36" fill="${INK_SOFT}"
        text-anchor="middle">${esc(ask)}</text>
  ${body}
  ${q.kind === 'find' ? '' : choiceRow(q.options, 760)}
  <text x="${W / 2}" y="${q.kind === 'find' ? 880 : 1000}" font-family="${SANS}" font-size="34"
        font-weight="700" fill="${GRID}" text-anchor="middle">정답은 옆으로 넘겨서 →</text>
  <text x="${W / 2}" y="${H - 178}" font-family="${SANS}" font-size="30" fill="${INK_FAINT}"
        text-anchor="middle">초등 1·2학년이 자주 틀리는 맞춤법</text>`);
}

/* ---------------- 2장: 정답 ---------------- */
function cardAnswer(q) {
  let body = '';
  let extra = '';
  if (q.kind === 'find') {
    // 빨간펜 교정 그대로 — 틀린 말을 긋고 바른 말을 그 위에 씁니다.
    const i = q.prompt.indexOf(q.answer);
    const before = q.prompt.slice(0, i);
    const after = q.prompt.slice(i + q.answer.length);
    const Y = 680;
    const r = runs(
      [{ text: before }, { text: q.answer, color: INK_SOFT }, { text: after }],
      { y: Y, size: 62 },
    );
    const s = r.size;
    const x0 = (W - (widthOf(before, s) + widthOf(q.answer, s) + widthOf(after, s))) / 2;
    const wx = x0 + widthOf(before, s);
    const ww = widthOf(q.answer, s);
    // 바른 말은 그은 줄 위로 충분히 띄웁니다 — 붙으면 둘이 겹쳐 읽히지 않습니다.
    body = `${r.svg}
    <line x1="${wx}" y1="${Y - s * 0.3}" x2="${wx + ww}" y2="${Y - s * 0.3}"
          stroke="${PEN}" stroke-width="7" stroke-linecap="round"/>
    <text x="${wx + ww / 2}" y="${Y - s * 1.12}" font-family="${SERIF}" font-size="${s * 0.9}"
          font-weight="700" fill="${PEN}" text-anchor="middle">${esc(q.correction || '')}</text>`;
  } else {
    const [before, after] = q.prompt.split('___');
    body = runs(
      [{ text: before }, { cell: true, text: q.answer, ground: GRID_TINT }, { text: after }],
      { y: 620, size: 62 },
    ).svg;
    extra = choiceRow(q.options, 760, { mark: { answer: q.answer } });
  }
  return frame(`
  ${label(q.tag)}
  <text x="${W / 2}" y="430" font-family="${SANS}" font-size="42" font-weight="700"
        fill="${GRID}" text-anchor="middle">정답</text>
  ${body}
  ${extra}
  <text x="${W / 2}" y="${q.kind === 'find' ? 880 : 1000}" font-family="${SANS}" font-size="34"
        font-weight="700" fill="${GRID}" text-anchor="middle">왜 그런지는 다음 장에 →</text>`);
}

/*
  큰따옴표를 낫표(「」)로 바꿉니다. 국어 공책의 결에 맞고, 명조에서 곧은 따옴표는
  타자기처럼 보입니다. 앱 화면은 본문 글꼴이라 그대로 두고 카드에서만 바꿉니다.
*/
const quotes = (s) => s.replace(/"([^"]*)"/g, '「$1」');

/* ---------------- 3장: 왜 ---------------- */
function cardWhy(q) {
  const text = quotes(q.explanation);
  const maxW = W - PAD * 2 - 40;
  const n = lineCount(text, 50, maxW);
  const top = 600 - (n - 1) * 39;
  return frame(
    `
  ${label(q.tag)}
  <text x="${W / 2}" y="430" font-family="${SANS}" font-size="42" font-weight="700"
        fill="${PEN}" text-anchor="middle">왜 그럴까요?</text>
  ${lines(text, { y: top, size: 50, gap: 78, color: INK, font: SANS, maxW })}
  <rect x="${PAD}" y="${H - 400}" width="${W - PAD * 2}" height="250" rx="28"
        fill="${PAPER_SUNK}" stroke="${GRID_FAINT}" stroke-width="2"/>
  ${cell(PAD + 44, H - 348, 100, '받')}
  <text x="${PAD + 184}" y="${H - 296}" font-family="${SERIF}" font-size="44" font-weight="700"
        fill="${GRID_DEEP}">받아쓰기 공책</text>
  <text x="${PAD + 184}" y="${H - 244}" font-family="${SANS}" font-size="31" fill="${INK_SOFT}">맞춤법 ${bankCounts().spelling}문제 · 받아쓰기 ${bankCounts().dictationLevels}단계</text>
  <text x="${PAD + 184}" y="${H - 196}" font-family="${SANS}" font-size="31" fill="${GRID_DEEP}">프로필 링크에서 바로 풀 수 있어요 ↑</text>`,
    // 상자 안에 이미 계정 이름이 있습니다. 아래에 또 적으면 같은 말이 두 번입니다.
    { footer: false },
  );
}

/* ---------------- 문항 읽어 오기 ---------------- */
function loadBank() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/data/spelling-bank.ts'), 'utf8');
  const re =
    /\{\s*id: '([^']+)',\s*kind: '([^']+)',\s*level: '([^']+)',\s*prompt: '([^']*)',\s*options: \[([^\]]*)\],\s*answer: '([^']*)',(?:\s*correction: '([^']*)',)?\s*explanation: '([^']*)',\s*tag: '([^']*)',/g;
  const out = {};
  let m;
  while ((m = re.exec(src))) {
    out[m[1]] = {
      id: m[1], kind: m[2], level: m[3], prompt: m[4],
      options: m[5].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean),
      answer: m[6], correction: m[7], explanation: m[8], tag: m[9],
    };
  }
  return out;
}

/*
  첫 아홉 장. 고른 기준은 둘입니다 —
  (1) 부모도 헷갈리는 것: 저장·공유가 여기서 납니다.
  (2) 저학년이 실제로 그렇게 쓰는 것: 이 계정이 누구 것인지 드러납니다.
  아래 차례대로 올립니다. 인스타는 최신이 위라 마지막 셋이 맨 윗줄에 놓입니다.
*/
const PICK = [
  'myeochil-1',  // 며칠 / 몇일 — 어른이 가장 많이 틀립니다
  'dwae-3',      // 되 / 돼
  'nat-1',       // 나았 / 낳았
  'an-2',        // 안 / 않
  'find-6',      // 꼬치 → 꽃이 — 1학년이 실제로 이렇게 씁니다
  'ssiot-4',     // 등굣길
  'waen-2',      // 웬 떡
  'damgeuda-1',  // 담가요 / 담궈요
  'fill-2',      // 앉아서 — 겹받침
];

/*
  릴스(make-reel.cjs)가 색·글꼴·격자·글자 폭 어림을 그대로 씁니다.
  두 벌로 두면 카드와 릴스가 언젠가 다른 물건처럼 보입니다 — 같은 계정인데요.
*/
/**
 * 문제은행에 든 개수. 카드·릴스의 안내 문구(「맞춤법 128문제 · 받아쓰기 20단계」)가 씁니다.
 *
 * **숫자를 손으로 적지 않습니다.** 맞춤법을 76 → 128문항으로 늘린 날,
 * 두 스크립트에 「76문제」가 박혀 있어 새로 뽑은 영상이 틀린 숫자를 말할 뻔했습니다.
 * 영상에 박힌 글자는 올린 뒤에 못 고치니, 뽑을 때마다 셉니다.
 */
let counted = null;
function bankCounts() {
  if (counted) return counted;
  const dictation = fs.readFileSync(path.join(__dirname, '..', 'src/data/dictation-bank.ts'), 'utf8');
  counted = {
    spelling: Object.keys(loadBank()).length,
    dictationLevels: new Set([...dictation.matchAll(/id:\s*'(lv\d+)'/g)].map((m) => m[1])).size,
  };
  return counted;
}

module.exports = {
  W, H, PAD, PAPER, PAPER_SUNK, INK, INK_SOFT, INK_FAINT,
  GRID, GRID_DEEP, GRID_FAINT, GRID_TINT, PEN, PEN_TINT,
  SERIF, SANS, widthOf, wrap, esc, cell, lines, lineCount, loadBank, runs, bankCounts,
};

// 직접 실행할 때만 그립니다. require 로 부품만 가져다 쓸 때는 안 돕니다.
if (require.main !== module) return;

(async () => {
  const bank = loadBank();
  const dir = path.join(__dirname, '..', 'insta');
  fs.mkdirSync(dir, { recursive: true });

  for (const [i, id] of PICK.entries()) {
    const q = bank[id];
    if (!q) throw new Error('문항을 못 찾았습니다: ' + id);
    const no = String(i + 1).padStart(2, '0');
    const pages = [cardQuestion(q), cardAnswer(q), cardWhy(q)];
    for (const [j, svg] of pages.entries()) {
      await sharp(Buffer.from(svg)).png().toFile(path.join(dir, `${no}_${j + 1}.png`));
    }
    console.log(`${no}. ${q.tag}  (${id})  3장`);
  }
  console.log('\n→ insta/ 폴더에 ' + PICK.length * 3 + '장');
})();
