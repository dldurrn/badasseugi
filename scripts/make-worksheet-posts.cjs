// 받아쓰기 프린트 글(45번~) 만들기 — scripts/worksheets-data.cjs 의 데이터로 blog/posts/*.html 을 쓰고
// scripts/build-blog-posts.cjs 의 POSTS 에 항목을 더합니다. 이미 있는 글·항목은 건드리지 않습니다.
// 44번은 손으로 쓴 글이라 만들지 않습니다.
const fs = require('fs');
const path = require('path');
const sheets = require('./worksheets-data.cjs').filter((s) => s.n >= 45);
const ROOT = path.join(__dirname, '..');
const buildPath = path.join(__dirname, 'build-blog-posts.cjs');
let build = fs.readFileSync(buildPath, 'utf8');
const esc = (s) => s.replace(/'/g, "\'");

for (const s of sheets) {
  const file = `${s.n}-${s.slug}.html`;
  const rows = s.sentences.map((t, i) => `    <tr><td>${i + 1}</td><td>${t}</td><td>${s.notes[i]}</td></tr>`).join('\n');
  const tips = s.tips.map((t) => `  <li>${t}</li>`).join('\n');
  const related = s.related.map(([slug, label]) => `  <li><a href="/entry/${slug}">${label}</a></li>`).join('\n');
  const html = `<!--
  [발행 정보]
  제목     : ${s.blogTitle}
  카테고리 : 학습 자료
  주소(슬러그): ${s.slug}
  태그     : ${s.tags.join(', ')}
-->

<p data-ke-size="size16">${s.lead}</p>

<div class="cta-box">
  <strong>${s.title} (PDF, A4 3쪽)</strong>
  <p>${s.sub} · 원고지 15칸 · 정답지와 읽어 주기 안내 포함. 회원가입 없이 바로 받을 수 있어요.</p>
  <a class="cta-btn" href="https://badasseugi.com/worksheets/${s.file}" target="_blank" rel="noopener">PDF 내려받기 →</a>
</div>

<h2 data-ke-size="size26">${s.ruleH}</h2>
${s.rule}

<h2 data-ke-size="size26">이런 구성이에요</h2>
<table data-ke-align="alignLeft" data-ke-style="style8">
  <thead><tr><td>쪽</td><td>내용</td><td>누가 써요</td></tr></thead>
  <tbody>
    <tr><td>1쪽 문제지</td><td>한 줄 15칸 원고지 10줄. 이름·날짜·점수 칸 포함</td><td>아이</td></tr>
    <tr><td>2쪽 정답지</td><td>같은 원고지 칸에 정답을 적어 두었어요. 내가 쓴 칸과 나란히 놓고 비교해요</td><td>아이 · 부모님</td></tr>
    <tr><td>3쪽 불러 주기</td><td>문장 10개와 짚어 줄 곳, 앱으로 이어지는 QR</td><td>부모님</td></tr>
  </tbody>
</table>

<h2 data-ke-size="size26">이 프린트로 연습하는 방법</h2>
<ol data-ke-list-type="decimal">
  <li><b>1쪽만 아이에게 주세요.</b> 정답이 보이지 않게 2쪽·3쪽은 부모님이 가지고 있어요.</li>
  <li><b>문장을 천천히 한 번, 끊어서 한 번, 이어서 한 번</b> 읽어 주세요. 쓰는 동안 철자는 알려 주지 않아요.</li>
  <li><b>다 쓰면 2쪽 정답지와 칸을 맞춰 비교하세요.</b> 틀린 글자 위에 동그라미를 치고, 틀린 문장만 한 번 더 써 보면 돼요.</li>
</ol>

<h2 data-ke-size="size26">들어 있는 문장 10개와 짚어 줄 곳</h2>
<table data-ke-align="alignLeft" data-ke-style="style8">
  <thead><tr><td>번호</td><td>문장</td><td>짚어 줄 곳</td></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>

<h2 data-ke-size="size26">채점할 때 이렇게 해 보세요</h2>
<ul data-ke-list-type="disc">
${tips}
</ul>
<p data-ke-size="size16">종이로 쓰면 읽어 주는 사람이 계속 옆에 있어야 하고, 채점도 직접 해야 해요. <b>소리를 들려주고 자동으로 채점하는 방식</b>이 필요하면 앱을 함께 써 보세요.</p>

<h2 data-ke-size="size26">앱에서도 연습할 수 있어요</h2>
<p data-ke-size="size16"><b>받아쓰기 공책</b>은 같은 원고지 칸에 직접 쓰고, 내가 쓴 글자와 정답을 위아래로 나란히 놓고 채점해 줘요. 틀린 문장은 오답노트에 모아서 같은 규칙의 다른 문제로 다시 풀어요.</p>

<div class="cta-box">
  <strong>가입 없이 한 문장 써 보세요</strong>
  <p>소리를 듣고 원고지에 써 보면 어디서 달랐는지 바로 보여 줘요.</p>
  <a class="cta-btn" href="https://badasseugi.com/try?utm_source=tistory&utm_medium=blog&utm_campaign=${s.slug}" target="_blank" rel="noopener">한 문장 써 보기 →</a>
</div>

<h2 data-ke-size="size26">함께 보면 좋은 글</h2>
<ul data-ke-list-type="disc">
${related}
  <li><a href="/entry/dictation-print-pdf-1">받아쓰기 프린트 PDF 1, 쉬운 문장 10개</a></li>
</ul>
`;
  const out = path.join(ROOT, 'blog/posts', file);
  fs.writeFileSync(out, html);
  const entry = `  {
    src: '${file}',
    cover: { l1: '${esc(s.cover.l1)}', l2: '${esc(s.cover.l2)}', sub: '${esc(s.cover.sub)}', chars: [${s.cover.chars.map((c) => `'${esc(c)}'`).join(', ')}] },
    images: [],
    naver: {
      title: '${esc(s.naverTitle)}',
      intro: '${esc(s.naverIntro)}',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 종이 대신 소리를 듣고 원고지에 쓰고 자동 채점까지 받는 연습은 아래 앱에서 가입 없이 해 볼 수 있어요.',
      tags: [${s.tags.map((t) => `'${esc(t)}'`).join(', ')}],
    },
  },
`;
  if (!build.includes(`src: '${file}'`)) {
    build = build.replace(/\];\n\n\/\* ---------- 대표 이미지 ---------- \*\//, entry + '];\n\n/* ---------- 대표 이미지 ---------- */');
  }
  console.log('글:', file);
}
fs.writeFileSync(buildPath, build);
