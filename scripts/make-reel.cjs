/*
  릴스 영상을 만듭니다.
    node scripts/make-reel.cjs            세 편 전부
    node scripts/make-reel.cjs --sample   첫 편의 「훅 + 3·2·1」만 (디자인·템포 확인용)

  결과: insta/reel/<이름>.mp4 (1080×1920, 30fps, 효과음 포함)

  팔로워가 0명인 계정에서 캐러셀은 갈 곳이 없습니다 — 인스타는 게시물을 먼저
  팔로워에게 보내는데 받을 사람이 없으니까요. 릴스만 처음부터 남에게 갑니다.

  **정지 화면을 이어 붙이면 슬라이드쇼이지 릴스가 아닙니다.**
  그래서 30fps 로 한 장씩 그려 ffmpeg 로 붙입니다.

  **효과음도 파일 없이 만듭니다.** ffmpeg 의 sine 으로 틱·딩·부저를 합성합니다.
  앱의 sfx.ts 가 음원 파일 없이 Web Audio 로 소리를 내는 것과 같은 이유입니다 —
  구할 것도, 저작권을 따질 것도, 저장소에 넣을 것도 없습니다.

  색·글꼴·원고지 칸은 make-cards.cjs 것을 그대로 씁니다.
  릴스로 들어온 사람이 프로필에서 카드를 볼 때 같은 물건이어야 합니다.
*/
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');
const ffmpeg = require('ffmpeg-static');
const {
  W, PAPER, PAPER_SUNK, INK, INK_SOFT, INK_FAINT, GRID, GRID_DEEP, GRID_FAINT, GRID_TINT,
  PEN, PEN_TINT, SERIF, SANS, widthOf, esc, cell, lines, runs, loadBank,
} = require('./make-cards.cjs');

const H = 1920; // 9:16
const PAD = 84;
const FPS = 30;

/*
  세로 자리를 한곳에 모아 둡니다. 여백이 어긋나는 것은 대개 숫자가 여기저기
  흩어져 있어서입니다 — 한 장면만 고치면 다른 장면과 안 맞습니다.

  인스타가 아래쪽 350px 남짓을 캡션·계정 이름으로 덮고 오른쪽에 버튼 줄이 섭니다.
  그래서 눈에 들어오는 자리는 위쪽으로 치우친 0~1570 이고,
  글 덩어리의 한가운데가 그 한가운데(≈785)에 오도록 잡았습니다.
  1400 아래로는 아무것도 두지 않습니다.
*/
const LABEL_Y = 240; // 꼬리표 윗변
const LABEL_H = 64;
const HANDLE_Y = 1450;

const HOOK_1 = 640; // 훅 첫 줄 기준선
const HOOK_2 = 752; // 둘째 줄 — 한 문장이라 붙여 둡니다
const HOOK_Q = 1030; // 문제 문장
const HOOK_HINT = 1290;

const CQ_Y = 470; // 카운트다운·정답 화면의 문제 문장
const RING_R = 100;

/*
  보기 개수에 따라 자리가 달라집니다. 한 벌로 못 박으면 셋짜리에서
  카운트다운 원이 아래로 밀려 계정 이름과 겹칩니다 —
  세로 자리는 정해져 있으니 늘어난 개수만큼 어딘가는 줄어야 합니다.
*/
function layout(n) {
  const three = n >= 3;
  const optY = three ? 570 : 600;
  const h = three ? 128 : 156;
  const gap = three ? 24 : 34;
  const bottom = optY + n * h + (n - 1) * gap;
  return { optY, h, gap, bottom, ringY: Math.max(1180, bottom + 110 + RING_R) };
}

/* ---------------- 움직임 ---------------- */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 끝에서 부드럽게 멎습니다. 일정한 속도로 움직이면 기계가 민 것처럼 보입니다. */
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
/** start 부터 dur 동안 0 → 1 */
const at = (t, start, dur) => easeOut((t - start) / dur);

/**
 * 팟 하고 나타나기. 1을 살짝 넘겼다가 돌아옵니다.
 * 정확히 1로 멎으면 「나타났다」가 아니라 「원래 있었다」로 보입니다.
 */
function pop(t, start, dur = 0.28) {
  const p = clamp01((t - start) / dur);
  if (p >= 1) return 1;
  return 0.86 + 0.14 * easeOut(p) + Math.sin(p * Math.PI) * 0.05;
}

/** 가운데를 기준으로 키웁니다. 왼쪽 위 기준이면 물체가 오른쪽 아래로 흐릅니다. */
const scaleAt = (cx, cy, s, inner) =>
  `<g transform="translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})">${inner}</g>`;

const fadeG = (o, inner) => `<g opacity="${clamp01(o).toFixed(3)}">${inner}</g>`;

/** 글이 제자리에서 켜지기만 하면 정지 화면입니다. 조금 올라오면서 켜집니다. */
const rise = (a, inner, px = 26) =>
  `<g transform="translate(0 ${((1 - a) * px).toFixed(1)})">${fadeG(a, inner)}</g>`;

/* ---------------- 조각 ---------------- */

function backdrop() {
  const s = 108;
  let out = '';
  for (let x = 0; x <= W; x += s) out += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 0; y <= H; y += s) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  return `<g stroke="${GRID}" stroke-width="1.5" opacity="0.05">${out}</g>`;
}

/*
  형식(FORMATS). 뼈대는 같고 말투만 다른 편들을 이름으로 골라 씁니다.

  「맞춤법 한 문제」와 「아빠도 틀렸습니다」는 장면 구성이 똑같습니다 —
  다른 것은 위 꼬리표·아래 한 줄뿐인데, 그것이 코드에 박혀 있으면
  말투 하나 바꾸자고 스크립트를 고치게 됩니다. 그러면 안 바꾸게 되고요.

  `tail` 은 계정의 성격을 매 장면 밑에 깔아 두는 자리입니다.
  「앱」이라는 말은 쓰지 않습니다 — 스토어에 없는 물건이라 찾으러 갔다가 돌아옵니다.
*/
const FORMATS = {
  /** 아이가 틀리는 문항. 전환을 만듭니다 — 학부모가 「우리 애 얘기네」 하고 누릅니다. */
  quiz: {
    label: '맞춤법 한 문제',
    hint: '3초 안에 골라보세요',
    tail: '초등 1·2학년 받아쓰기 · 맞춤법',
  },
  /*
    어른이 틀리는 문항. 도달을 법니다.

    꼬리표가 「아빠도 틀렸습니다」였을 때는 훅(「이거 저도 방금 틀렸어요」)과
    같은 말을 두 번 해서 둘 다 약했습니다. 꼬리표는 코너 이름으로 두고
    고백은 훅에 맡깁니다.

    아래 한 줄에 **누가 만들었고 누구를 위한 것인지**를 넣습니다 —
    어른 문항으로 들어온 사람에게 이게 없으면 「나랑 상관없네」 하고 나갑니다.
  */
  dad: {
    label: '청개구리 아빠 실험실',
    // 「정답은 스와이프 →」였습니다. 릴스는 알아서 재생되므로 아무 일도 안 하고,
    // 시키는 대로 손가락을 움직이면 **다음 영상으로 넘어가** 완주율만 깎였습니다.
    hint: '아빠는 3초 만에 틀렸습니다',
    tail: '초등 아들 받아쓰기 봐주다 만들었습니다 🐸',
  },
};

const fmt = (reel) => ({ ...FORMATS.quiz, ...(FORMATS[reel.format] || {}) });

function frame(inner, reel) {
  const tail = reel && fmt(reel).tail;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${backdrop()}
  <rect x="0" y="0" width="${W}" height="14" fill="${GRID}"/>
  ${inner}
  ${
    tail
      ? `<text x="${W / 2}" y="${HANDLE_Y - 54}" font-family="${SANS}" font-size="31"
             fill="${INK_SOFT}" text-anchor="middle">${esc(tail)}</text>`
      : ''
  }
  <text x="${W / 2}" y="${HANDLE_Y}" font-family="${SANS}" font-size="34"
        fill="${INK_FAINT}" text-anchor="middle">@badasseugi_note</text>
</svg>`;
}

/*
  꼬리표. 카드와 같은 모양이라 같은 계정 것으로 읽힙니다.
  문항 태그를 쓰지 않고 늘 같은 말을 씁니다 — 「설레다」 같은 태그는 답을 흘리고,
  편마다 말이 달라지면 계정의 형식으로 안 읽힙니다.
*/
function labelPill(text = '맞춤법 한 문제', tone = 'grid') {
  const w = widthOf(text, 32) + 64;
  const bg = tone === 'pen' ? PEN_TINT : GRID_TINT;
  const fg = tone === 'pen' ? PEN : GRID_DEEP;
  return `
  <rect x="${(W - w) / 2}" y="${LABEL_Y}" width="${w}" height="${LABEL_H}" rx="${LABEL_H / 2}"
        fill="${bg}"/>
  <text x="${W / 2}" y="${LABEL_Y + 43}" font-family="${SANS}" font-size="32" font-weight="700"
        fill="${fg}" text-anchor="middle">${esc(text)}</text>`;
}

/**
 * 가운데 한 줄. 넘치면 글자를 줄입니다 — 릴스는 잘린 글자를 다시 볼 수 없습니다.
 *
 * `xml:space="preserve"` 가 없으면 **연속 공백이 한 칸으로 접힙니다.**
 * 「짓다 = 만들다   짖다 = 소리 내다」에서 사이를 벌려 둔 공백 셋이 사라져
 * 두 항목이 한 줄로 붙어 읽혔습니다. 폭은 공백까지 재어 자리를 잡아 두는데
 * 글자만 당겨지니, 잰 것과 그린 것이 어긋납니다.
 */
function fit(text, y, size, { color = INK, font = SERIF, weight = 400, maxW = W - PAD * 2 } = {}) {
  let s = size;
  while (widthOf(text, s) > maxW && s > 30) s -= 2;
  return `<text x="${W / 2}" y="${y}" xml:space="preserve" font-family="${font}" font-size="${s}"
          font-weight="${weight}" fill="${color}" text-anchor="middle">${esc(text)}</text>`;
}

/**
 * 문제 문장. 빈칸을 **원고지 칸**으로 그립니다.
 * 동그라미(○○○)로 두었더니 카드와 딴 물건으로 보였습니다 —
 * 칸이 이 앱의 시그니처이고, 칸 수가 곧 글자 수 힌트이기도 합니다.
 */
function questionLine(q, y, size, { filled = false } = {}) {
  const [before, after] = q.prompt.split('___');
  return runs(
    [
      { text: before },
      filled
        ? { cell: true, text: q.answer, ground: GRID_TINT, color: GRID_DEEP }
        : { cell: true, text: '', slots: [...q.answer].length },
      { text: after },
    ],
    { y, size, maxW: W - PAD * 2 - 40 },
  ).svg;
}

/**
 * 보기 상자.
 * @param state  상자마다 'neutral' | 'right' | 'wrong'
 * @param strike 틀린 보기에 줄이 그어진 정도 0~1 — 한 번에 나타나면 그어진 게 아니라 원래 있던 게 됩니다
 */
function options(q, { state = () => 'neutral', appear = () => 1, strike = 0 } = {}) {
  const bw = W - PAD * 2;
  const { optY: y, h: boxH, gap } = layout(q.options.length);
  return q.options
    .map((op, i) => {
      const st = state(op, i);
      const top = y + i * (boxH + gap);
      const mid = top + boxH / 2;
      const right = st === 'right';
      const wrong = st === 'wrong';
      const fill = right ? GRID_TINT : wrong ? PEN_TINT : '#ffffff';
      const stroke = right ? GRID : wrong ? PEN : GRID_FAINT;
      let fs = Math.min(72, boxH * 0.48);
      while (widthOf(op, fs) > bw - 200 && fs > 36) fs -= 2;

      let inner = `
      <rect x="${PAD}" y="${top}" width="${bw}" height="${boxH}" rx="26"
            fill="${fill}" stroke="${stroke}" stroke-width="${right || wrong ? 5 : 3}"/>
      <text x="${W / 2}" y="${mid + fs * 0.36}" font-family="${SERIF}" font-size="${fs}" font-weight="700"
            fill="${right ? GRID_DEEP : wrong ? INK_SOFT : INK}" text-anchor="middle">${esc(op)}</text>`;

      if (wrong && strike > 0) {
        const lw = widthOf(op, fs) + 60;
        const x1 = (W - lw) / 2;
        inner += `<line x1="${x1}" y1="${mid + 4}" x2="${x1 + lw * clamp01(strike)}" y2="${mid + 4}"
                  stroke="${PEN}" stroke-width="8" stroke-linecap="round"/>`;
      }
      // 맞은 쪽에는 표식을 안 답니다 — 카운트다운 자리에 뜨는 큰 동그라미가 그 몫이라,
      // 여기에 또 달면 「맞음」을 두 번 말하게 됩니다.
      if (wrong) {
        inner += scaleAt(
          W - PAD - 62, mid, pop(strike, 0.35, 0.25),
          `<text x="${W - PAD - 62}" y="${mid + 20}" font-size="54"
                 text-anchor="middle">❌</text>`,
        );
      }
      const a = appear(i);
      return a >= 1 ? inner : fadeG(a, scaleAt(W / 2, mid, 0.92 + 0.08 * a, inner));
    })
    .join('');
}

/* ---------------- 장면 ---------------- */

function sceneHook(q, reel, t) {
  const F = fmt(reel);
  const a1 = at(t, 0.15, 0.4);
  const a2 = at(t, 0.35, 0.4);
  const aq = at(t, 0.95, 0.45);
  const ah = at(t, 1.75, 0.4);
  return frame(`
  ${rise(at(t, 0, 0.4), labelPill(F.label), 16)}
  ${rise(a1, fit(reel.hook[0], HOOK_1, 62, { font: SANS, color: INK_SOFT }))}
  ${rise(a2, fit(reel.hook[1], HOOK_2, 84, { font: SANS, weight: 700, color: PEN }))}
  ${rise(
    aq,
    `<rect x="${PAD}" y="${HOOK_Q - 148}" width="${W - PAD * 2}" height="246" rx="30"
           fill="${PAPER_SUNK}" stroke="${GRID_FAINT}" stroke-width="2.5"/>
     ${questionLine(q, HOOK_Q, 62)}`,
    30,
  )}
  ${fadeG(ah, fit(F.hint, HOOK_HINT, 48, { font: SANS, weight: 700, color: GRID }))}`, reel);
}

function sceneCount(q, reel, t) {
  const F = fmt(reel);
  const n = Math.max(1, 3 - Math.floor(t)); // 3초 한 장면 안에서 3 → 2 → 1
  const frac = t - Math.floor(t); // 이번 1초가 얼마나 지났나
  const cy = layout(q.options.length).ringY;
  const C = 2 * Math.PI * RING_R;

  return frame(`
  ${labelPill(F.label)}
  ${questionLine(q, CQ_Y, 50)}
  ${options(q, { appear: (i) => at(t, i * 0.09, 0.32) })}
  <circle cx="${W / 2}" cy="${cy}" r="${RING_R}" fill="${GRID_TINT}"/>
  <circle cx="${W / 2}" cy="${cy}" r="${RING_R}" fill="none" stroke="${GRID}" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
          stroke-dashoffset="${(C * frac).toFixed(1)}"
          transform="rotate(-90 ${W / 2} ${cy})"/>
  ${scaleAt(
    W / 2, cy, pop(frac, 0, 0.18),
    `<text x="${W / 2}" y="${cy + 46}" font-family="${SANS}" font-size="126" font-weight="700"
           fill="${GRID_DEEP}" text-anchor="middle">${n}</text>`,
  )}`, reel);
}

/*
  앞 장면(3·2·1)과 **자리를 그대로 씁니다.** 문제 문장도 보기 상자도 움직이지 않고,
  바뀌는 것은 칸이 채워지는 것·틀린 보기에 줄이 그어지는 것뿐입니다.
  여기서 다시 날아 들어오게 하면 답을 보러 온 눈이 처음부터 다시 자리를 찾습니다.

  카운트다운 원이 있던 자리에는 **동그라미 표시**가 들어옵니다 —
  시간을 세던 원이 그대로 「맞았다」가 되니 눈이 옮겨 갈 곳이 없습니다.
  국어 공책에서 맞은 것에 치는 그 ○ 이기도 합니다.
*/
function sceneAnswer(q, reel, t) {
  const L = layout(q.options.length);
  /*
    정답과 오답 사이를 1.1초 벌렸습니다. 예전에는 0.4초라 딩 소리가 채 끝나기 전에
    부저가 겹쳐, 맞은 것을 확인할 틈도 없이 다음 것이 왔습니다.
  */
  const showRight = t >= 0.6;
  const showWrong = t >= 1.7;
  const strike = clamp01((t - 1.7) / 0.4);
  return frame(`
  ${labelPill('정답')}
  ${questionLine(q, CQ_Y, 50, { filled: showRight })}
  ${options(q, {
    state: (op) =>
      op === q.answer ? (showRight ? 'right' : 'neutral') : showWrong ? 'wrong' : 'neutral',
    strike: showWrong ? strike : 0,
  })}
  ${fadeG(1 - at(t, 0, 0.35), `<circle cx="${W / 2}" cy="${L.ringY}" r="${RING_R}" fill="${GRID_TINT}"/>`)}
  ${circleMark(W / 2, L.ringY, clamp01((t - 0.6) / 0.45))}`, reel);
}

/*
  맞았다는 표시. 국어 공책에서 선생님이 치는 그 ○ 입니다.
  **그려지는 것처럼 한 획으로 돕니다** — 다 그려진 채로 뜨면 도장이지 채점이 아니고,
  카운트다운 원이 있던 자리라 「시간이 다 됐다」의 잔상이 그대로 남습니다.
*/
function circleMark(cx, cy, p) {
  if (p <= 0) return '';
  const r = RING_R + 4;
  const C = 2 * Math.PI * r;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GRID}" stroke-width="18"
          stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
          stroke-dashoffset="${(C * (1 - easeOut(p))).toFixed(1)}"
          transform="rotate(-90 ${cx} ${cy})"/>`;
}

/*
  틀린 표기와 바른 표기를 **한 상자에 나란히** 놓습니다.
  예전에는 「설레임 ❌ 설렘 ⭕」처럼 한 줄에 이모지로 적었는데,
  이 PC 글꼴에서 이모지가 흑백으로 나와 ❌ 가 검게 찍혔습니다 —
  이 팔레트에 없는 색이고, 어느 쪽이 틀린 것인지 색으로 안 읽혔습니다.
  그은 줄과 색이 이모지보다 정확합니다.
*/
const BONUS_H = 270;

/**
 * 두 낱말을 한 상자에 나란히.
 *
 * **라벨과 취소선을 고를 수 있습니다.** 대개는 「틀린 표기 / 바른 표기」지만,
 * 짓다·짖다처럼 **둘 다 맞는 말인데 뜻이 다른** 경우가 있습니다.
 * 거기에 「틀린 표기」를 붙이면 그 자체가 거짓말이 됩니다 —
 * 「지어요」는 이 문장에서 틀린 것이지 없는 말이 아닙니다.
 *
 * 그런 문항을 한 줄짜리 안내(bonusNote)로 밀어 넣었더니
 * 「짓다 = 만들다 짖다 = 소리 내다」가 한 줄로 붙어 경계가 안 보였습니다.
 * 견주는 것은 견주는 모양으로 그려야 합니다.
 */
function comparePair(y, left, right, opt = {}) {
  const { leftLabel = '틀린 표기', rightLabel = '바른 표기', strike = true } = opt;
  const cw = (W - PAD * 2) / 2;
  const lx = PAD + cw / 2;
  const rx = PAD + cw + cw / 2;
  /*
    두 낱말이 같은 크기여야 나란히 견줍니다 — 한쪽만 작으면 그쪽이 덜 중요해 보입니다.
    「삼가해 주세요」처럼 긴 것이 칸을 넘으므로 **둘 다** 긴 쪽에 맞춰 줄입니다.
    칸막이에 닿지 않게 넉넉히 뺍니다.
  */
  let size = 70;
  while (Math.max(widthOf(left, size), widthOf(right, size)) > cw - 90 && size > 34) size -= 2;
  const lw = widthOf(left, size) + 24;
  // 라벨도 칸을 넘을 수 있습니다 — 「소리 내다」처럼 뜻 풀이가 오면 길어집니다.
  let ls = 32;
  while (Math.max(widthOf(leftLabel, ls), widthOf(rightLabel, ls)) > cw - 60 && ls > 20) ls -= 2;

  return `
  <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${BONUS_H}" rx="30"
        fill="#ffffff" stroke="${GRID_FAINT}" stroke-width="2.5"/>
  <line x1="${W / 2}" y1="${y + 46}" x2="${W / 2}" y2="${y + BONUS_H - 46}"
        stroke="${GRID_FAINT}" stroke-width="2"/>
  <text x="${lx}" y="${y + 150}" font-family="${SERIF}" font-size="${size}" font-weight="700"
        fill="${strike ? INK_SOFT : INK}" text-anchor="middle">${esc(left)}</text>
  ${
    strike
      ? `<line x1="${lx - lw / 2}" y1="${y + 128}" x2="${lx + lw / 2}" y2="${y + 128}"
              stroke="${PEN}" stroke-width="7" stroke-linecap="round"/>`
      : ''
  }
  <text x="${lx}" y="${y + 214}" font-family="${SANS}" font-size="${ls}" font-weight="700"
        fill="${strike ? PEN : INK_SOFT}" text-anchor="middle">${esc(leftLabel)}</text>
  <text x="${rx}" y="${y + 150}" font-family="${SERIF}" font-size="${size}" font-weight="700"
        fill="${GRID_DEEP}" text-anchor="middle">${esc(right)}</text>
  <text x="${rx}" y="${y + 214}" font-family="${SANS}" font-size="${ls}" font-weight="700"
        fill="${strike ? GRID : INK_SOFT}" text-anchor="middle">${esc(rightLabel)}</text>`;
}

/** 짝이 아니라 목록인 문항(겹받침 같은)은 한 줄로 둡니다. */
function bonusNote(y, text) {
  return `
  <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${BONUS_H}" rx="30"
        fill="${GRID_TINT}" stroke="${GRID_FAINT}" stroke-width="2.5"/>
  ${fit(text, y + 158, 62, { weight: 700, color: GRID_DEEP })}`;
}

function sceneWhy(q, reel, t) {
  const text = q.explanation.replace(/"([^"]*)"/g, '「$1」');
  /*
    보너스 상자는 세 모양입니다.
      '한 줄 규칙'                        → 초록 상자 한 줄
      { wrong, right }                    → 틀린 표기 / 바른 표기
      { left, leftLabel, right, rightLabel } → 둘 다 맞는 말인데 뜻이 다를 때
  */
  const b = reel.bonus;
  const box =
    typeof b === 'string'
      ? bonusNote(880, b)
      : 'wrong' in b
        ? comparePair(880, b.wrong, b.right)
        : comparePair(880, b.left, b.right, {
            leftLabel: b.leftLabel,
            rightLabel: b.rightLabel,
            strike: false,
          });
  return frame(`
  ${rise(at(t, 0, 0.3), labelPill('왜 그럴까요?', 'pen'), 16)}
  ${rise(at(t, 0.25, 0.45), lines(text, { y: 560, size: 60, gap: 96, color: INK, font: SANS }))}
  ${rise(at(t, 1.1, 0.45), box, 34)}`, reel);
}

/*
  「전부 무료」라고 적지 않습니다. 릴스는 지워지지 않고, 캡션은 고쳐도
  영상에 박힌 글자는 못 고칩니다 — 요금제를 켜는 날 그대로 증거가 됩니다.
  게다가 하필 「사진으로 문제 넣기」를 나란히 두고 있었습니다. plan.ts 에서
  무료의 정의가 `photoInput: false` 인, 유료로 갈 바로 그 기능입니다.

  대신 plan.ts 가 **영구히 안 잠그기로 못 박은 것**만 이름을 댑니다 —
  원고지·채점·오답노트·내장 문제은행. 요금제를 켠 뒤에도 이 문장은 그대로 참입니다.
*/
function sceneCta(q, reel, t) {
  return frame(`
  ${scaleAt(W / 2, 392, pop(t, 0, 0.35), cell(W / 2 - 92, 300, 184, '받'))}
  ${rise(at(t, 0.2, 0.32), fit('받아쓰기 공책', 600, 72, { weight: 700, color: GRID_DEEP }))}
  ${rise(at(t, 0.3, 0.32), fit('초등 1·2학년 받아쓰기 · 맞춤법', 678, 42, { font: SANS, color: INK_SOFT }))}
  ${rise(at(t, 0.5, 0.32), fit('받아쓰기 20단계 · 맞춤법 76문제', 850, 46, { font: SANS, color: INK }))}
  ${rise(at(t, 0.6, 0.32), fit('원고지 채점 · 오답노트', 928, 46, { font: SANS, color: INK }))}
  ${rise(at(t, 0.72, 0.32), fit('무료로 씁니다', 1040, 52, { font: SANS, weight: 700, color: GRID_DEEP }))}
  ${rise(
    at(t, 0.95, 0.4),
    `<rect x="${PAD}" y="1150" width="${W - PAD * 2}" height="140" rx="28" fill="${GRID}"/>
     ${fit('프로필 링크에서 바로 풀어보세요', 1238, 46, { font: SANS, weight: 700, color: '#ffffff' })}`,
    30,
  )}`, reel);
}

/*
  장면과 길이. 훅을 1.5초에서 2.6초로 늘렸습니다 —
  두 줄을 읽고 문제까지 보기에 1.5초는 넘기라고 떠미는 시간이었습니다.
*/
const TIMELINE = [
  { name: 'hook', draw: sceneHook, dur: 2.6 },
  { name: 'count', draw: sceneCount, dur: 3.0 },
  { name: 'answer', draw: sceneAnswer, dur: 3.8 },
  { name: 'why', draw: sceneWhy, dur: 3.4 },
  { name: 'cta', draw: sceneCta, dur: 2.8 },
];

/*
  일부 장면만 뽑아 보기: `--only=answer,why,cta`
  전체를 매번 다시 뽑으면 고친 자리를 보기까지 오래 걸립니다.
  소리 시각은 startOf 가 잘라낸 목록에서 다시 세므로 여기서도 화면과 맞습니다.
*/
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const SAMPLE = ONLY.length > 0;
const SCENES = SAMPLE ? TIMELINE.filter((s) => ONLY.split(',').includes(s.name)) : TIMELINE;
if (SCENES.length === 0) throw new Error('그런 장면이 없습니다: ' + ONLY);
const DURATION = SCENES.reduce((a, s) => a + s.dur, 0);

/** `--reel=2` 처럼 한 편만. 세 편을 매번 다시 뽑으면 오래 걸립니다. */
const PICK_N = Number((process.argv.find((a) => a.startsWith('--reel=')) || '').slice(7)) || 0;
const LIST = process.argv.includes('--list');

/** 장면이 몇 초에 시작하나. 소리를 여기에 맞춥니다. */
function startOf(name) {
  let t = 0;
  for (const s of SCENES) {
    if (s.name === name) return t;
    t += s.dur;
  }
  return null;
}

/*
  효과음. 파일이 아니라 ffmpeg 의 sine 으로 그 자리에서 만듭니다.

  **시각을 손으로 적지 않고 장면 시작에서 계산합니다.** 예전에는 1.5초·4.9초처럼
  박아 두어, 훅 길이를 고치자 틱이 카운트다운보다 먼저 울렸습니다.
  소리가 화면과 어긋나면 없느니만 못합니다.
*/
function buildSfx() {
  const out = [];
  const c = startOf('count');
  if (c !== null) {
    for (let i = 0; i < 3; i++) out.push({ at: c + i, freq: 1200, dur: 0.07, vol: 0.5 });
  }
  const a = startOf('answer');
  if (a !== null) {
    out.push({ at: a + 0.6, freq: 880, dur: 0.5, vol: 0.42 }); // 딩 — 두 음을 겹쳐 종소리처럼
    out.push({ at: a + 0.6, freq: 1320, dur: 0.5, vol: 0.3 });
    out.push({ at: a + 1.7, freq: 190, dur: 0.22, vol: 0.4 }); // 부저
  }
  return out;
}
const SFX = buildSfx();

/*
  `format` 이 말투를 정하고, `id` 가 문제를 정하고, `hook` 두 줄만 편마다 씁니다.
  같은 문항도 형식이 다르면 다른 편이 되므로 76문항이 그대로 마르지 않습니다.
*/
/*
  dad 2 : quiz 1 이고 **번갈아** 올립니다.
  dad 가 도달을 벌고 quiz 가 전환을 만듭니다 — dad 만 내면 인스타가 이 계정을
  「어른 맞춤법 계정」으로 배워서, 팔로워는 늘고 링크는 안 눌리는 계정이 됩니다.

  훅은 **1줄에 장면, 2줄에 결과**입니다. 「저도 틀렸습니다」처럼 장면이 없으면
  상황 설명이지 훅이 아니라, 보는 사람이 멈출 이유가 없습니다.
  그리고 셋의 감정이 다릅니다 — 반전 · 위기 · 굴욕. 연달아 봐도 안 질리게요.
*/
const REELS = [
  {
    file: '1_오랜만',
    id: 'oraenman-1',
    format: 'dad',
    /*
      훅에 「오랜만」을 쓸 수 없습니다 — 그게 정답이라 3초 세기 전에 답이 샙니다.
      그래서 낱말 대신 **상황**만 만듭니다. 「동창」이면 오랜만에 연락하는
      장면이 저절로 그려집니다.
    */
    hook: ['동창한테 카톡 보내다', '세 번을 고쳐 썼습니다'],
    bonus: { wrong: '오랫만', right: '오랜만' },
  },
  {
    file: '2_짖어요',
    id: 'jitda-2',
    format: 'quiz',
    // 틀렸을 때 벌어지는 일을 그림으로 보여 줍니다. 「짓다」는 오답 쪽이라 정답도 안 샙니다.
    hook: ['받침 하나 때문에', '강아지가 밥을 짓습니다'],
    /*
      「틀린 표기 / 바른 표기」가 아니라 **뜻 라벨**을 답니다.
      「지어요」는 틀린 표기가 아니라 **다른 뜻의 바른 말**이라,
      「틀린 표기」라고 붙이면 그 자체가 거짓말이 됩니다.
      취소선도 긋지 않습니다 — 없는 말이 아니니까요.
    */
    bonus: { left: '짓다', leftLabel: '만들다', right: '짖다', rightLabel: '소리 내다' },
  },
  {
    file: '3_설거지',
    id: 'seolgeoji-1',
    format: 'dad',
    hook: ['매일 하는 집안일인데', '쓸 줄은 몰랐습니다'],
    bonus: { wrong: '설겆이', right: '설거지' },
  },
];

/** 한 프레임이 어느 장면의 몇 초인지. */
function frameSvg(q, reel, i) {
  let t = i / FPS;
  for (const scene of SCENES) {
    if (t < scene.dur) return scene.draw(q, reel, t);
    t -= scene.dur;
  }
  const last = SCENES[SCENES.length - 1];
  return last.draw(q, reel, last.dur);
}

async function render(q, reel, dir) {
  const total = Math.round(DURATION * FPS);
  // 멈춰 있는 구간은 프레임이 똑같습니다. 같은 그림을 다시 그리지 않고 그대로 씁니다.
  let lastSvg = null;
  let lastBuf = null;
  for (let i = 0; i < total; i++) {
    const svg = frameSvg(q, reel, i);
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
  // 소리 없는 바닥을 먼저 깔아야 영상 길이만큼 오디오가 채워집니다.
  args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${DURATION}`);
  for (const s of SFX) args.push('-f', 'lavfi', '-i', `sine=f=${s.freq}:d=${s.dur}:r=44100`);

  const parts = SFX.map((s, i) => {
    const src = i + 2; // 0 은 영상, 1 은 무음 바닥
    return `[${src}:a]volume=${s.vol},afade=t=out:st=0:d=${s.dur},adelay=${Math.round(s.at * 1000)}[s${i}]`;
  });
  const mix = ['[1:a]', ...SFX.map((_, i) => `[s${i}]`)].join('');
  /*
    섞은 뒤 한 번 더 올립니다. 그냥 두면 최고점이 -21dB 라 폰 스피커에서
    거의 안 들립니다 — 효과음이 안 들리면 없는 것과 같습니다.
    올리기만 하면 찌그러지므로 alimiter 로 천장을 눌러 둡니다.
  */
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

/*
  `--list` — 문제은행에 뭐가 있는지 봅니다.
  릴스로 만들 문항을 고르려면 76개를 눈으로 훑어야 하는데,
  그러자고 TypeScript 파일을 열게 하면 다음 편을 안 만들게 됩니다.
*/
function printBank(bank) {
  const used = new Set(REELS.map((r) => r.id));
  const byTag = {};
  for (const q of Object.values(bank)) (byTag[q.tag] ||= []).push(q);
  for (const [tag, qs] of Object.entries(byTag)) {
    console.log(`\n[${tag}]`);
    for (const q of qs) {
      const mark = used.has(q.id) ? '✔ ' : '  ';
      console.log(`${mark}${q.id.padEnd(14)} ${q.prompt}  → ${q.answer}`);
    }
  }
  console.log('\n✔ = 이미 릴스로 만든 것. id 를 REELS 에 넣으면 다음 편이 됩니다.');
}

(async () => {
  const bank = loadBank();
  if (LIST) return printBank(bank);

  const outDir = path.join(__dirname, '..', 'insta', 'reel');
  fs.mkdirSync(outDir, { recursive: true });

  const chosen = PICK_N ? [REELS[PICK_N - 1]] : SAMPLE ? REELS.slice(0, 1) : REELS;
  if (chosen.some((r) => !r)) throw new Error(`--reel 은 1~${REELS.length} 입니다`);

  for (const reel of chosen) {
    const q = bank[reel.id];
    if (!q) throw new Error('문항을 못 찾았습니다: ' + reel.id);
    /*
      find 형은 빈칸(`___`)이 없고 「문장에서 틀린 낱말 찾기」라 이 뼈대에 안 맞습니다.
      막아 두지 않으면 문제 자리에 조용히 「undefined」가 찍힌 영상이 나옵니다 —
      다 만들고 폰에 옮긴 뒤에야 알게 됩니다.
    */
    if (q.kind === 'find') {
      throw new Error(`${reel.id} 는 find 형이라 릴스로 못 만듭니다. mcq·fill 문항을 고르세요.`);
    }
    const name = SAMPLE ? '_sample' : reel.file;

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
    try {
      process.stdout.write(`${name}  [${q.tag}]  그리는 중… `);
      const n = await render(q, reel, tmp);
      process.stdout.write(`${n}장 → 붙이는 중… `);
      const out = path.join(outDir, name + '.mp4');
      encode(tmp, out);
      if (!SAMPLE) {
        // 표지는 훅이 다 뜬 뒤로 잡습니다 — 0초는 아직 글이 켜지는 중입니다.
        await sharp(Buffer.from(frameSvg(q, reel, Math.round(2.3 * FPS))))
          .png()
          .toFile(path.join(outDir, reel.file + '_표지.png'));
      }
      console.log(`완료 (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)}MB)`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log(`\n→ insta/reel/ · 각 ${DURATION.toFixed(1)}초`);
})();
