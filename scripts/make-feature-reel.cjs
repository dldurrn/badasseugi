/*
  기능 소개 릴스를 만듭니다. `node scripts/make-feature-reel.cjs [--reel=N] [--sample] [--only=scene,...]`

  결과: channels/instagram/기능소개/<이름>.mp4 (1080×1920, 30fps, 효과음 포함)

  make-reel.cjs 는 맞춤법 문제은행에서 퀴즈 형식을 뽑습니다.
  이건 다릅니다 — **문제은행 문항이 아니라 앱 화면 자체**(원고지·채점표·문제 넣기)를
  촬영 없이 다시 그려서 보여 줍니다. 촬영이 필요한 것은 실제 손가락·실기기이지
  화면 자체는 이미 정해진 규칙(원고지, 채점 색, 표식)대로 그려지므로 SVG 로 흉내 낼 수 있습니다.

  **채점 장면의 칸 데이터는 지어낸 게 아닙니다.** 실제 `grading.ts`의 `grade()`를
  돌려서 나온 columns 를 그대로 옮겨 적었습니다(아래 GRADE_DEMO 주석 참고).
  지어내면 "실제로는 안 그런데?" 하는 순간 신뢰를 잃습니다 — 이 계정의 정체성이
  "정확하게 짚어 준다"는 것이라 더 그렇습니다.

  움직임·효과음·인코딩은 make-reel.cjs 와 같은 방식입니다. 두 스크립트가
  독립적인 이유는 make-reel.cjs 도 자기 것을 안 나눠 썼기 때문입니다 —
  형식(퀴즈)과 형식(화면 시연)이 서로 다른 종류라 공유할 게 뼈대뿐이고,
  뼈대를 무리하게 공유 모듈로 빼면 둘 다 남의 사정을 신경 써야 합니다.

  색·글꼴·칸은 make-cards.cjs 것을 그대로 씁니다 — 카드·릴스·앱이 같은 물건으로 읽혀야 합니다.
*/
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');
const ffmpeg = require('ffmpeg-static');
const {
  PAPER, PAPER_SUNK, INK, INK_SOFT, INK_FAINT, GRID, GRID_DEEP, GRID_FAINT, GRID_TINT,
  PEN, PEN_TINT, SERIF, SANS, widthOf, esc, bankCounts,
} = require('./make-cards.cjs');

// globals.css 에는 있는데 make-cards.cjs 가 안 내보내는 색. 여기서만 씁니다.
const PEN_DEEP = '#a92e20';
const RULE_STRONG = '#d5cfbd';

const W = 1080;
const H = 1920; // 9:16
const PAD = 84;
const FPS = 30;

/*
  「모바일 화면」쪽을 그립니다 — CLAUDE.md 의 원고지 반응형 표에서 폰(세로) 쪽 비율입니다.
  릴스 캔버스 자체가 세로 폰 화면이라, 데스크탑 720px 기둥을 그대로 넣으면
  실제로 아이·부모가 자기 폰에서 보는 것과 다른 걸 보여주는 셈이 됩니다.
*/
const GRID_COLS = 15; // WONGOJI_COLS — 학교 문제지와 맞춘 한 줄 칸 수, 항상 15
const GRID_W = W - PAD * 2; // 912
const CELL = GRID_W / GRID_COLS; // ≈60.8 — 폰 칸(23px)보다 크지만 1080 캔버스 비례로는 같은 70% 규칙을 씁니다

/* ---------------- 움직임 (make-reel.cjs 와 같은 식) ---------------- */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const at = (t, start, dur) => easeOut((t - start) / dur);
function pop(t, start, dur = 0.28) {
  const p = clamp01((t - start) / dur);
  if (p >= 1) return 1;
  return 0.86 + 0.14 * easeOut(p) + Math.sin(p * Math.PI) * 0.05;
}
const scaleAt = (cx, cy, s, inner) =>
  `<g transform="translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})">${inner}</g>`;
const fadeG = (o, inner) => `<g opacity="${clamp01(o).toFixed(3)}">${inner}</g>`;
const rise = (a, inner, px = 26) =>
  `<g transform="translate(0 ${((1 - a) * px).toFixed(1)})">${fadeG(a, inner)}</g>`;

function backdrop() {
  const s = 108;
  let out = '';
  for (let x = 0; x <= W; x += s) out += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 0; y <= H; y += s) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  return `<g stroke="${GRID}" stroke-width="1.5" opacity="0.05">${out}</g>`;
}

/** 릴스 공통 틀 — 위 배경, 아래 계정 이름. 카드·기존 릴스와 같은 자리에 둡니다. */
function frame(inner, tail) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${backdrop()}
  <rect x="0" y="0" width="${W}" height="14" fill="${GRID}"/>
  ${inner}
  ${
    tail
      ? `<text x="${W / 2}" y="1396" font-family="${SANS}" font-size="31"
             fill="${INK_SOFT}" text-anchor="middle">${esc(tail)}</text>`
      : ''
  }
  <text x="${W / 2}" y="1450" font-family="${SANS}" font-size="34"
        fill="${INK_FAINT}" text-anchor="middle">@badasseugi_note</text>
</svg>`;
}

function labelPill(text, tone = 'grid') {
  const w = widthOf(text, 32) + 64;
  const bg = tone === 'pen' ? PEN_TINT : GRID_TINT;
  const fg = tone === 'pen' ? PEN : GRID_DEEP;
  return `
  <rect x="${(W - w) / 2}" y="240" width="${w}" height="64" rx="32" fill="${bg}"/>
  <text x="${W / 2}" y="282" font-family="${SANS}" font-size="32" font-weight="700"
        fill="${fg}" text-anchor="middle">${esc(text)}</text>`;
}

function fitText(text, y, size, { color = INK, font = SERIF, weight = 400 } = {}) {
  const w = widthOf(text, size);
  const maxW = W - PAD * 2;
  const s = w > maxW ? (size * maxW) / w : size;
  return `<text x="${W / 2}" y="${y}" font-family="${font}" font-size="${s.toFixed(1)}"
        font-weight="${weight}" fill="${color}" text-anchor="middle">${esc(text)}</text>`;
}

/* ---------------- 원고지 칸 ---------------- */

/**
 * 칸 하나. `size` 만 넣으면 make-cards.cjs 의 `cell()` 과 같은 비율(글자 70%)입니다.
 * 채점표 전용이라 배경·테두리·표식을 색으로 직접 고를 수 있게 열어 둡니다.
 */
function gcCell(x, y, size, ch, { bg = '#ffffff', border = GRID_FAINT, borderW = 1.5, textColor = INK, circle = false, mark = null } = {}) {
  const mid = x + size / 2;
  const midY = y + size / 2;
  const rx = circle ? size / 2 : size * 0.08;
  let inner = '';
  if (mark === 'vee') {
    inner = `<path d="M${mid - size * 0.16} ${midY - size * 0.14} L${mid} ${midY + size * 0.2} L${mid + size * 0.16} ${midY - size * 0.16}"
      stroke="${PEN}" stroke-width="${size * 0.09}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  } else if (mark === 'cross') {
    inner = `<path d="M${mid - size * 0.16} ${midY - size * 0.16} L${mid + size * 0.16} ${midY + size * 0.16}
      M${mid + size * 0.16} ${midY - size * 0.16} L${mid - size * 0.16} ${midY + size * 0.16}"
      stroke="${PEN}" stroke-width="${size * 0.09}" stroke-linecap="round" fill="none"/>`;
  } else if (mark === 'dot') {
    inner = `<circle cx="${mid}" cy="${midY}" r="${size * 0.05}" fill="${textColor}"/>`;
  } else if (ch) {
    inner = `<text x="${mid}" y="${midY + size * 0.29}" font-family="${SERIF}" font-size="${size * 0.7}"
      font-weight="700" fill="${textColor}" text-anchor="middle">${esc(ch)}</text>`;
  }
  return `
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}"
        fill="${bg}" stroke="${border}" stroke-width="${borderW}"/>
  ${inner}`;
}

/**
 * 채점표 두 줄(내가 쓴 것 위 / 정답 아래) — `columns`는 `grading.ts`의 실제 반환값입니다.
 * `reveal` 은 0~columns.length. 그 앞 칸까지만 채워지고 뒤는 아직 빈 칸으로 둡니다 —
 * 한 칸씩 짚이는 것처럼 보이게 하려고요(카운트다운 뒤 순차 등장).
 */
function gradeRows(columns, y, reveal = columns.length) {
  let out = '';
  const padded = [...columns];
  while (padded.length < GRID_COLS) padded.push({ kind: 'pad' });
  padded.forEach((col, i) => {
    const x = PAD + i * CELL;
    const shown = i < reveal;
    // 위: 내가 쓴 것
    if (!shown) {
      out += gcCell(x, y, CELL, null, { bg: PAPER_SUNK, border: RULE_STRONG });
    } else if (col.kind === 'same') {
      out += gcCell(x, y, CELL, col.input, { bg: '#ffffff', border: GRID_FAINT });
    } else if (col.kind === 'diff' || col.kind === 'extra') {
      out += gcCell(x, y, CELL, col.input, {
        bg: PEN_TINT, border: PEN, borderW: 3, textColor: PEN_DEEP, circle: col.error === 'batchim',
      });
    } else if (col.kind === 'needSpace') {
      out += gcCell(x, y, CELL, null, { bg: PEN_TINT, border: PEN, borderW: 3, mark: 'vee' });
    } else if (col.kind === 'extraSpace') {
      out += gcCell(x, y, CELL, null, { bg: PEN_TINT, border: PEN, borderW: 3, mark: 'cross' });
    } else if (col.kind === 'missing') {
      out += gcCell(x, y, CELL, null, { bg: PAPER_SUNK, border: RULE_STRONG, mark: 'dot' });
    } else {
      out += gcCell(x, y, CELL, null, { bg: PAPER, border: RULE_STRONG });
    }
    // 아래: 정답
    const ay = y + CELL;
    if (!shown) {
      out += gcCell(x, ay, CELL, null, { bg: PAPER_SUNK, border: RULE_STRONG });
    } else if (col.kind === 'same') {
      out += gcCell(x, ay, CELL, col.answer, { bg: GRID_TINT, border: GRID_FAINT, textColor: GRID_DEEP });
    } else if (col.kind === 'diff' || col.kind === 'missing') {
      out += gcCell(x, ay, CELL, col.answer, {
        bg: '#ffffff', border: GRID, borderW: 3, textColor: GRID_DEEP, circle: col.error === 'batchim',
      });
    } else if (col.kind === 'needSpace') {
      out += gcCell(x, ay, CELL, null, { bg: '#ffffff', border: GRID, borderW: 3 });
    } else if (col.kind === 'extra' || col.kind === 'extraSpace') {
      out += gcCell(x, ay, CELL, null, { bg: PAPER_SUNK, border: RULE_STRONG, mark: 'dot' });
    } else {
      out += gcCell(x, ay, CELL, null, { bg: PAPER, border: RULE_STRONG });
    }
  });
  return out;
}

/** 한 줄짜리 원고지(정답만, 또는 아이가 쓰는 중인 모습) */
function plainRow(chars, y, { fill = false, tint = false } = {}) {
  let out = '';
  for (let i = 0; i < GRID_COLS; i++) {
    const x = PAD + i * CELL;
    const ch = chars[i] || null;
    out += gcCell(x, y, CELL, ch, {
      bg: tint ? GRID_TINT : '#ffffff',
      border: GRID_FAINT,
      textColor: tint ? GRID_DEEP : INK,
      borderW: fill && ch ? 2.5 : 1.5,
    });
  }
  return out;
}

/*
  실제 채점 결과 — 손으로 지어내지 않고 `grade('작은 발자국', '자근발자국')`을
  돌려서 나온 그대로입니다(2026-09-18 확인). 문장을 바꾸면 다시 돌려서 옮겨 적으세요.

  들리는 대로 쓰면 「작은」이 [자근]이 됩니다. 한 낱말에 받침(batchim)·첫소리(consonant)
  실수가 같이 들어 있고, 뒤에 띄어쓰기(needSpace)까지 있어 세 가지를 한 번에 보여줍니다.
*/
const GRADE_DEMO = {
  input: '자근발자국',
  answer: '작은 발자국',
  columns: [
    { kind: 'diff', input: '자', answer: '작', error: 'batchim' },
    { kind: 'diff', input: '근', answer: '은', error: 'consonant' },
    { kind: 'needSpace' },
    { kind: 'same', input: '발', answer: '발' },
    { kind: 'same', input: '자', answer: '자' },
    { kind: 'same', input: '국', answer: '국' },
  ],
};

/* ---------------- 장면 ---------------- */

const TAIL = '초등 1·2학년 받아쓰기 · 맞춤법';

/** 0~2.6s 훅 */
function sceneHook(t) {
  const a1 = at(t, 0.05, 0.4);
  const a2 = at(t, 0.35, 0.4);
  const a3 = at(t, 0.75, 0.4);
  return frame(`
  ${rise(a1, fitText('아이가 받아쓰기에', 560, 58, { font: SANS, color: INK_SOFT }))}
  ${rise(a2, fitText('「자근발자국」이라고', 660, 62, { weight: 700 }))}
  ${rise(a2, fitText('썼습니다', 750, 62, { weight: 700 }))}
  ${rise(a3, fitText('틀린 곳이 몇 군데일까요?', 880, 56, { font: SANS, weight: 700, color: PEN }))}
  ${fadeG(at(t, 1.1, 0.4), plainRow([...GRADE_DEMO.input], 1040))}
  `, TAIL);
}

/** 2.6~5.5s — 소리로 불러 주고 원고지에 써지는 모습 */
function sceneListen(t) {
  const speakerPulse = 1 + Math.sin(t * 9) * 0.08;
  return frame(`
  ${labelPill('문장 듣기')}
  ${fitText('작은 발자국', 470, 60, { color: GRID_DEEP, weight: 700 })}
  ${scaleAt(W / 2, 620, speakerPulse, `
    <circle cx="${W / 2}" cy="620" r="70" fill="${GRID_TINT}"/>
    <path d="M${W / 2 - 24} 600 h-20 v40 h20 l30 26 v-92 z" fill="${GRID_DEEP}"/>
    <path d="M${W / 2 + 22} 596 a48 48 0 0 1 0 48" stroke="${GRID_DEEP}" stroke-width="6" fill="none" stroke-linecap="round"/>
  `)}
  ${fadeG(at(t, 0.3, 0.4), fitText('듣고 원고지에 씁니다', 800, 44, { font: SANS, color: INK_SOFT }))}
  ${rise(at(t, 0.6, 0.4), plainRow([...GRADE_DEMO.input], 960, { fill: true }))}
  ${rise(at(t, 1.4, 0.4), `<rect x="${W / 2 - 140}" y="1120" width="280" height="96" rx="20" fill="${GRID}"/>
    <text x="${W / 2}" y="1178" font-family="${SANS}" font-size="40" font-weight="700"
          fill="#ffffff" text-anchor="middle">제출하기</text>`)}
  `, TAIL);
}

/** 5.5~8.5s 카운트다운 */
function sceneCount(t) {
  const n = Math.min(3, Math.floor(t) + 1);
  const label = ['3', '2', '1'][n - 1] || '1';
  const p = pop(t, Math.floor(t), 0.28);
  return frame(`
  ${labelPill('채점 중')}
  ${plainRow([...GRADE_DEMO.input], 900, { fill: true })}
  ${scaleAt(W / 2, 1250, p, `
    <circle cx="${W / 2}" cy="1250" r="110" fill="${GRID_TINT}" stroke="${GRID}" stroke-width="4"/>
    <text x="${W / 2}" y="1278" font-family="${SERIF}" font-size="110" font-weight="700"
          fill="${GRID_DEEP}" text-anchor="middle">${label}</text>`)}
  `, TAIL);
}

/** 8.5~12.5s 채점 결과 — 칸이 순서대로 짚입니다 */
function sceneGrade(t) {
  const reveal = Math.min(6, Math.floor(t / 0.5));
  return frame(`
  ${labelPill('채점 결과', 'pen')}
  ${fitText('작은 발자국', 470, 52, { font: SANS, color: INK_SOFT })}
  ${gradeRows(GRADE_DEMO.columns, 560)}
  ${fadeG(at(t, 3.0, 0.4), `
    <rect x="${PAD}" y="${560 + CELL * 2 + 60}" width="${GRID_W}" height="190" rx="24"
          fill="${PEN_TINT}" stroke="${PEN}" stroke-width="2"/>
    <text x="${W / 2}" y="${560 + CELL * 2 + 118}" font-family="${SANS}" font-size="42" font-weight="700"
          fill="${PEN_DEEP}" text-anchor="middle">틀린 곳 3군데</text>
    <text x="${W / 2}" y="${560 + CELL * 2 + 172}" font-family="${SANS}" font-size="34"
          fill="${INK_SOFT}" text-anchor="middle">받침 · 첫소리 · 띄어쓰기</text>`)}
  `, TAIL);
}

/** 12.5~15.3s — 세 실수를 하나씩 설명 */
function sceneWhy(t) {
  const items = [
    ['자 → 작', '받침이 뒤로 넘어갔어요'],
    ['근 → 은', '넘어간 받침이 첫소리가 됐어요'],
    ['작은∨발자국', '띄어쓰기'],
  ];
  const idx = Math.min(items.length - 1, Math.floor(t / 1.1));
  const [head, body] = items[idx];
  const a = at(t, (idx * 1.1) + 0.05, 0.3);
  return frame(`
  ${labelPill('왜 틀렸을까요?', 'pen')}
  ${rise(a, `
    <rect x="${PAD}" y="700" width="${GRID_W}" height="360" rx="28" fill="${PAPER_SUNK}" stroke="${GRID_FAINT}" stroke-width="2"/>
    <text x="${W / 2}" y="840" font-family="${SERIF}" font-size="72" font-weight="700"
          fill="${PEN_DEEP}" text-anchor="middle">${esc(head)}</text>
    <text x="${W / 2}" y="960" font-family="${SANS}" font-size="46"
          fill="${INK}" text-anchor="middle">${esc(body)}</text>`)}
  <text x="${W / 2}" y="1180" font-family="${SANS}" font-size="36" fill="${INK_FAINT}"
        text-anchor="middle">${idx + 1} / ${items.length}</text>
  `, TAIL);
}

/** 15.3~18.1s 안내 */
function sceneCta(t) {
  return frame(`
  ${scaleAt(W / 2, 392, pop(t, 0, 0.35), `
    <rect x="${W / 2 - 92}" y="300" width="184" height="184" rx="20" fill="#ffffff" stroke="${GRID}" stroke-width="4"/>
    <text x="${W / 2}" y="${300 + 184 / 2 + 184 * 0.29}" font-family="${SERIF}" font-size="${184 * 0.6}"
          font-weight="700" fill="${GRID_DEEP}" text-anchor="middle">받</text>`)}
  ${rise(at(t, 0.2, 0.32), fitText('받아쓰기 공책', 600, 72, { weight: 700, color: GRID_DEEP }))}
  ${rise(at(t, 0.3, 0.32), fitText('초등 1·2학년 받아쓰기 · 맞춤법', 678, 42, { font: SANS, color: INK_SOFT }))}
  ${rise(at(t, 0.5, 0.32), fitText(`받아쓰기 ${bankCounts().dictationLevels}단계 · 맞춤법 ${bankCounts().spelling}문제`, 850, 46, { font: SANS, color: INK }))}
  ${rise(at(t, 0.6, 0.32), fitText('원고지 채점 · 오답노트', 928, 46, { font: SANS, color: INK }))}
  ${rise(at(t, 0.72, 0.32), fitText('무료로 씁니다', 1040, 52, { font: SANS, weight: 700, color: GRID_DEEP }))}
  ${rise(
    at(t, 0.95, 0.4),
    `<rect x="${PAD}" y="1150" width="${W - PAD * 2}" height="140" rx="28" fill="${GRID}"/>
     ${fitText('프로필 링크에서 바로 풀어보세요', 1238, 46, { font: SANS, weight: 700, color: '#ffffff' })}`,
    30,
  )}`, TAIL);
}

/* ---------------- 소리 ---------------- */
const TIMELINE = [
  { name: 'hook', draw: sceneHook, dur: 2.6 },
  { name: 'listen', draw: sceneListen, dur: 2.9 },
  { name: 'count', draw: sceneCount, dur: 3.0 },
  { name: 'grade', draw: sceneGrade, dur: 4.0 },
  { name: 'why', draw: sceneWhy, dur: 3.3 },
  { name: 'cta', draw: sceneCta, dur: 2.8 },
];

const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const SAMPLE = process.argv.includes('--sample');
const SCENES = ONLY ? TIMELINE.filter((s) => ONLY.split(',').includes(s.name)) : TIMELINE;
if (SCENES.length === 0) throw new Error('그런 장면이 없습니다: ' + ONLY);
const DURATION = SCENES.reduce((a, s) => a + s.dur, 0);

function startOf(name) {
  let t = 0;
  for (const s of SCENES) {
    if (s.name === name) return t;
    t += s.dur;
  }
  return null;
}

/** 소리는 장면이 시작할 때 붙습니다 — 화면과 절대 어긋나지 않습니다. */
function buildSfx() {
  const out = [];
  const tick = (a) => a !== null && out.push({ at: a, freq: 700, dur: 0.09, vol: 0.34 });
  // 카운트다운 3·2·1 — 1초마다 틱
  const c = startOf('count');
  if (c !== null) for (let i = 0; i < 3; i++) tick(c + i);
  // 채점 결과가 뜰 때 — 딩(두 음 겹침)
  const g = startOf('grade');
  if (g !== null) {
    out.push({ at: g + 0.1, freq: 880, dur: 0.5, vol: 0.4 });
    out.push({ at: g + 0.1, freq: 1320, dur: 0.5, vol: 0.28 });
    // 틀린 개수 상자가 뜰 때 — 부저
    out.push({ at: g + 3.0, freq: 190, dur: 0.22, vol: 0.38 });
  }
  return out;
}
const SFX = buildSfx();

function frameSvg(i) {
  let t = i / FPS;
  for (const scene of SCENES) {
    if (t < scene.dur) return scene.draw(t);
    t -= scene.dur;
  }
  const last = SCENES[SCENES.length - 1];
  return last.draw(last.dur);
}

async function render(dir) {
  const total = Math.round(DURATION * FPS);
  let lastSvg = null;
  let lastBuf = null;
  for (let i = 0; i < total; i++) {
    const svg = frameSvg(i);
    if (svg !== lastSvg) {
      lastBuf = await sharp(Buffer.from(svg)).png({ compressionLevel: 1 }).toBuffer();
      lastSvg = svg;
    }
    fs.writeFileSync(path.join(dir, String(i).padStart(4, '0') + '.png'), lastBuf);
  }
  return total;
}

function encode(dir, out) {
  const args = ['-y', '-framerate', String(FPS), '-i', path.join(dir, '%04d.png')];
  args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${DURATION}`);
  for (const s of SFX) args.push('-f', 'lavfi', '-i', `sine=f=${s.freq}:d=${s.dur}:r=44100`);

  const parts = SFX.map((s, i) => {
    const src = i + 2;
    return `[${src}:a]volume=${s.vol},afade=t=out:st=0:d=${s.dur},adelay=${Math.round(s.at * 1000)}[s${i}]`;
  });
  const mix = ['[1:a]', ...SFX.map((_, i) => `[s${i}]`)].join('');
  parts.push(
    `${mix}amix=inputs=${SFX.length + 1}:normalize=0:duration=first[m]`,
    `[m]volume=8,alimiter=limit=0.8[a]`,
  );

  args.push(
    '-filter_complex', parts.join(';'),
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k',
    '-t', String(DURATION),
    out,
  );
  execFileSync(ffmpeg, args, { stdio: 'pipe' });
}

(async () => {
  const outDir = path.join(__dirname, '..', 'channels', 'instagram', '기능소개');
  fs.mkdirSync(outDir, { recursive: true });
  const name = SAMPLE || ONLY ? '_sample' : '1_채점표';

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freel-'));
  try {
    process.stdout.write(`${name}  그리는 중… `);
    const n = await render(tmp);
    process.stdout.write(`${n}장 → 붙이는 중… `);
    const out = path.join(outDir, name + '.mp4');
    encode(tmp, out);
    if (!SAMPLE && !ONLY) {
      await sharp(Buffer.from(frameSvg(Math.round(2.3 * FPS))))
        .png()
        .toFile(path.join(outDir, name + '_표지.png'));
    }
    console.log(`완료 (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)}MB)`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n→ channels/instagram/기능소개/ · ${DURATION.toFixed(1)}초`);
})();
