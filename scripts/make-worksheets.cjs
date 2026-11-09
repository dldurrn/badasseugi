// 인쇄용 받아쓰기 PDF 만들기 — Chrome 헤드리스로 HTML 을 PDF 로 찍습니다.
// 왜 Chrome 인가: 이 PC 에 파이썬이 없고, 한글 글꼴·CSS 격자를 가장 적은 코드로 그대로 얻을 수 있습니다.
// 사용: node scripts/make-worksheets.cjs   → public/worksheets/*.pdf
// 문장은 전부 새로 썼습니다. 한 줄 15칸(띄어쓰기도 한 칸)에 들어가야 합니다.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const SHEETS = require('./worksheets-data.cjs');

const COLS = 15;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function row(n, text, filled) {
  const chars = [...text.replace(/([,.]) /g, '$1')]; // 쉼표·마침표 뒤 공백은 원고지에서 한 칸을 차지하지 않습니다
  if (chars.length > COLS) throw new Error(`15칸 초과: ${text}`);
  let cells = '';
  for (let i = 0; i < COLS; i++) {
    const ch = chars[i] ?? '';
    const punct = /[.,]/.test(ch); // 마침표·쉼표만 칸 왼쪽 아래, ?·! 는 칸 가운데
    cells += `<i class="${punct ? 'p' : ''}">${filled ? esc(ch) : ''}</i>`;
  }
  return `<div class="row"><b>${n}</b><div class="g">${cells}</div></div>`;
}

function qrBlock(sheet) {
  if (!sheet.qr) return '';
  const svg = fs.readFileSync(path.join(__dirname, 'worksheet-qr', sheet.qr), 'utf8');
  return `<div class="qr"><div class="qrimg">${svg}</div><div><b>종이 말고 앱으로도 해 보세요</b><br>소리를 들려주고, 원고지에 쓰면 자동으로 채점해 줘요.<br>QR을 찍으면 가입 없이 한 문장을 써 볼 수 있어요.</div></div>`;
}

function html(sheet) {
  const rows = (filled) => sheet.sentences.map((s, i) => row(i + 1, s, filled)).join('');
  const head = (label) => `
    <header><div><h1>${sheet.title}</h1><p>${sheet.sub}</p></div>
    <div class="who">${label}<span>이름 ____________ &nbsp; 날짜 ____월 ____일 &nbsp; 점수 ____ / 10</span></div></header>`;
  const read = sheet.sentences.map((s, i) => `<li><span>${i + 1}</span>${esc(s)}${sheet.notes ? `<em>${esc(sheet.notes[i])}</em>` : ''}</li>`).join('');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><style>
@page{size:A4;margin:14mm 12mm}
*{box-sizing:border-box}
body{margin:0;font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222}
section{page-break-after:always;min-height:268mm}
section:last-child{page-break-after:auto}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2f6f4f;padding-bottom:6px;margin-bottom:10mm}
h1{margin:0;font-family:'Batang','바탕',serif;font-size:24px;color:#2f6f4f}
header p{margin:2px 0 0;font-size:12px;color:#666}
.who{text-align:right;font-size:12px}.who span{display:block;margin-top:4px}
.who{font-weight:bold;color:#2f6f4f}.who span{font-weight:normal;color:#444}
.row{display:flex;align-items:center;margin-bottom:5.2mm}
.row b{width:8mm;font-size:13px;color:#2f6f4f}
.g{display:flex;border-top:1.2px solid #2f6f4f;border-left:1.2px solid #2f6f4f}
.g i{width:11.2mm;height:11.2mm;border-right:1.2px solid #2f6f4f;border-bottom:1.2px solid #2f6f4f;font-style:normal;
 font-family:'Batang','바탕',serif;font-size:19px;display:flex;align-items:center;justify-content:center;color:#222}
.g i.p{align-items:flex-end;padding-bottom:2px}
.ans .g i{color:#c0392b}
.tip{margin-top:6mm;font-size:12px;color:#555;line-height:1.7}
ol{list-style:none;padding:0;margin:0;font-size:17px}
li{padding:9px 0;border-bottom:1px dashed #bbb;font-family:'Batang','바탕',serif}
li em{float:right;font-family:'Malgun Gothic',sans-serif;font-style:normal;font-size:11px;color:#888;margin-top:5px}
li span{display:inline-block;width:9mm;font-family:'Malgun Gothic',sans-serif;font-size:13px;color:#2f6f4f;font-weight:bold}
.box{border:1.5px solid #2f6f4f;border-radius:6px;padding:10px 14px;font-size:12.5px;line-height:1.8;margin-bottom:8mm}
.qr{display:flex;align-items:center;gap:5mm;border:1.5px solid #2f6f4f;border-radius:6px;padding:4mm 5mm;margin-top:8mm;font-size:12.5px;line-height:1.7}
.qrimg{width:26mm;height:26mm;flex:none}.qrimg svg{width:100%;height:100%;display:block}
footer{margin-top:8mm;font-size:11px;color:#777;text-align:center}
</style>
<section>${head('문제지 · 들은 대로 칸에 써 보세요')}${rows(false)}
<p class="tip">한 칸에 한 글자씩, 띄어쓰기는 한 칸을 비워요. 마침표(.)는 칸의 왼쪽 아래에 찍어요.</p>
<footer>받아쓰기 공책 · badasseugi.com — 소리를 듣고, 칸에 쓰고, 틀린 곳을 바로 확인해요</footer></section>
<section class="ans">${head('정답지 · 내가 쓴 것과 칸을 맞춰 비교해요')}${rows(true)}
<p class="tip">틀린 곳은 빨간색으로 동그라미 하고, 틀린 문장은 다시 한 번 써 보세요. 이틀 뒤에 틀린 문장만 다시 풀면 기억이 오래 가요.</p>
<footer>받아쓰기 공책 · badasseugi.com</footer></section>
<section>${head('읽어 주는 분께 · 이 문장을 불러 주세요')}
<div class="box"><b>이렇게 불러 주세요</b><br>① 문장을 처음부터 끝까지 한 번 천천히 읽어요. ② 두세 덩어리로 끊어서 다시 읽어요. ③ 마지막에 한 번 더 이어서 읽어요. 같은 문장은 아이가 요청할 때만 다시 읽어 주세요. 쓰는 동안 철자는 알려 주지 않아요.</div>
<ol>${read}</ol>
${qrBlock(sheet)}<footer>받아쓰기 공책 · badasseugi.com</footer></section>
</html>`;
}

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Chrome/Edge 가 없습니다');
const out = path.join(__dirname, '..', 'public', 'worksheets');
fs.mkdirSync(out, { recursive: true });
for (const s of SHEETS) {
  if (process.env.WS_ONLY && String(s.no) !== process.env.WS_ONLY) continue;
  const tmp = path.join(os.tmpdir(), `ws-${Date.now()}.html`);
  fs.writeFileSync(tmp, html(s));
  if (process.env.WS_HTML) fs.copyFileSync(tmp, process.env.WS_HTML); // 미리보기용
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${path.join(out, s.file)}`, 'file:///' + tmp.split(path.sep).join('/')], { stdio: 'ignore' });
  fs.unlinkSync(tmp);
  console.log('만듦:', s.file);
}
