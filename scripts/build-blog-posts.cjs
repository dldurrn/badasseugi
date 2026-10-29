/*
  블로그 글(티스토리·네이버)과 이미지를 올릴 수 있는 모양으로 만듭니다.
  `node scripts/build-blog-posts.cjs`

  입력
    blog/posts/*.html          글 원본(티스토리 HTML 모드용, 맨 위 주석에 발행 정보)
    blog/images/ready/*.png    가공해 둔 캡처 (이름이 든 곳은 흐림 처리 끝낸 것)
  출력
    blog/publish/<글>/tistory.html   HTML 모드에 붙여 넣기
    blog/publish/<글>/naver-editor.html  브라우저로 열어 전체 복사 → 네이버 스마트에디터에 붙여 넣기
    blog/publish/<글>/images/        올릴 순서대로 번호를 붙인 이미지 (대표 이미지 포함)
    blog/publish/<글>/발행-안내.md   제목·카테고리·태그·이미지 위치·대체텍스트

  네이버 글은 티스토리 글과 **같은 내용이라 검색에서 중복 문서로 볼 수 있어서**
  제목·첫 문단·마무리 문단을 따로 씁니다. 본문 구조까지 같게 두는 것은 한계가 있습니다.

  글꼴은 앱 아이콘 스크립트와 같습니다(바탕·맑은 고딕). 이 PC 기준이며 Vercel 에서는 돌리지 않습니다.
*/
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'blog/posts');
const READY = path.join(ROOT, 'blog/images/ready');
const OUT = path.join(ROOT, 'blog/publish');

const PAPER = '#fbfaf6';
const GRID = '#2e7d5b';
const GRID_DEEP = '#1f5a41';
const GRID_FAINT = '#b9d6c8';
const INK = '#232b33';
const INK_SOFT = '#656f7b';
const SERIF = 'Batang, BatangChe, Gowun Batang, serif';
const SANS = 'Malgun Gothic, Apple SD Gothic Neo, sans-serif';

const WIDE = '본문 폭 가득';
const PHONE = '가로 360px 정도, 가운데 정렬';

const POSTS = [
  {
    src: '01-dictation-practice-alone-grade1.html',
    cover: { l1: '아이 혼자 하는', l2: '받아쓰기 5단계', sub: '초등 1학년 받아쓰기 연습 방법', chars: ['혼', '자'] },
    images: [
      { file: 'D-write-typing', name: '01-write-on-wongoji', size: WIDE,
        before: '<h3 data-ke-size="size23">4단계. 채점은 정답과 나란히 놓고 하게 하세요</h3>',
        alt: '원고지 칸에 띄어쓰기 한 칸을 비우고 받아쓰기 문장을 쓰는 화면' },
      { file: 'G-batchim-error', name: '02-compare-grading', size: WIDE,
        before: '<h3 data-ke-size="size23">5단계. 틀린 것만 모아 다음 날 한 번 더</h3>',
        alt: '내가 쓴 글자와 정답 글자를 위아래로 겹쳐 틀린 곳을 짚어 주는 채점 화면' },
      { file: 'A-step-list', name: '03-step-list', size: PHONE,
        before: '<div class="cta-box">',
        alt: '받아쓰기 공책 단계 목록과 연습하기 시험 보기 듣고 고르기 버튼' },
    ],
    naver: {
      title: '초등 1학년 받아쓰기 연습법 | 부모 없이 아이 혼자 하는 5단계',
      intro: '"받아쓰기 좀 불러 줘!" 소리가 매일 저녁 들리시나요? 불러 주고 채점하는 일을 아이가 스스로 할 수 있게 바꾸는 방법을 5단계로 정리했어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 아이가 혼자 해 보는 연습이 궁금하다면 아래 앱도 한번 써 보세요.',
      tags: ['초등받아쓰기', '초등1학년받아쓰기', '받아쓰기연습방법', '받아쓰기공부법', '초1받아쓰기', '초등학습', '받아쓰기혼자', '학습습관', '초등공부', '받아쓰기공책'],
    },
  },
  {
    src: '02-dictation-practice-sentences-grade1.html',
    cover: { l1: '받아쓰기 연습', l2: '문장 20개', sub: '초등 1학년 · 띄어쓰기 포인트 포함', chars: ['문', '장'] },
    images: [
      { file: 'G-batchim-error', name: '01-batchim-error', size: WIDE,
        before: '<h3 data-ke-size="size23">2. 띄어 쓰는 짧은 구 (4개)</h3>',
        alt: '안경을 안겨로 쓴 받침 오류를 짚어 주는 채점표' },
      { file: 'F-spacing-error', name: '02-spacing-error', size: WIDE,
        before: '<h3 data-ke-size="size23">3. 느낌표가 있는 문장 (3개)</h3>',
        alt: '작은 발자국을 붙여 쓴 띄어쓰기 오류를 V 표식으로 짚어 주는 채점표' },
      { file: 'C-write-empty', name: '03-empty-wongoji', size: WIDE,
        before: '<div class="cta-box">',
        alt: '소리를 듣고 쓰는 빈 원고지 받아쓰기 화면' },
    ],
    naver: {
      title: '초등 1학년 받아쓰기 문제 20문장 | 띄어쓰기·받침 포인트 정리',
      intro: '초등 1학년 받아쓰기, 집에서 연습할 문장이 필요하신가요? 쉬운 낱말부터 대화체까지 20문장을 골랐고, 문장마다 아이가 자주 헷갈리는 포인트를 짚어 두었어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 문장을 직접 불러 주기 번거롭다면 아래 앱에서 소리로 들려주는 연습도 해 보세요.',
      tags: ['초등받아쓰기', '받아쓰기문제', '받아쓰기연습문장', '초등1학년받아쓰기', '초1받아쓰기', '받아쓰기연습', '띄어쓰기', '받침', '초등학습', '받아쓰기공책'],
    },
  },
  {
    src: '03-dictation-score-not-rising-checklist.html',
    cover: { l1: '점수가 안 오를 때', l2: '점검할 5가지', sub: '80점대에서 막힌 아이의 부모님께', chars: ['점', '검'] },
    images: [
      { file: 'I-report-types', name: '01-report-types', size: PHONE,
        before: '<h2 data-ke-size="size26">2. 귀로 구분이 안 되는 소리인지 확인하세요</h2>',
        alt: '부모용 리포트에서 띄어쓰기 자음 받침 모음 오답 종류를 막대로 보여 주는 화면' },
      { file: 'H-wrong-notes', name: '02-wrong-notes', size: PHONE,
        before: '<h2 data-ke-size="size26">4. 연습 간격과 양을 점검하세요</h2>',
        alt: '별 두 개를 모아야 졸업하는 오답노트 화면' },
      { file: 'E-confirm', name: '03-confirm-before-submit', size: WIDE,
        before: '<h2 data-ke-size="size26">이 점검을 대신해 주는 방법</h2>',
        alt: '제출하기 전에 이대로 제출할까요 하고 한 번 더 확인하는 화면' },
    ],
    naver: {
      title: '받아쓰기 점수 80점에서 안 오를 때, 이 5가지부터 확인하세요',
      intro: '연습은 열심히 하는데 받아쓰기 점수가 80점대에서 멈췄다면, 연습량보다 연습 방식을 점검해 볼 때예요. 확인할 5가지를 순서대로 알려 드릴게요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 아이가 어디서 틀리는지 기록으로 보고 싶다면 아래 앱을 참고해 보세요.',
      tags: ['받아쓰기점수', '받아쓰기100점', '받아쓰기공부법', '받아쓰기틀리는이유', '초등받아쓰기', '오답노트', '초등학습', '초등1학년', '받아쓰기연습', '받아쓰기공책'],
    },
  },
  {
    src: '05-dictation-batchim-common-mistakes.html',
    cover: { l1: '자주 틀리는', l2: '받침 정리', sub: 'ㅅ · ㅆ · ㄲ · 겹받침 구분법', chars: ['받', '침'] },
    images: [
      { file: 'A2-step-list-lv11', name: '01-step-list-lv11', size: PHONE,
        before: '<h3 data-ke-size="size23">④ 소리 나는 대로 이어 쓰는 경우</h3>',
        alt: '겹받침 낱말 11단계가 따로 있는 받아쓰기 공책 단계 목록' },
      { file: 'G-batchim-error', name: '02-batchim-grading', size: WIDE,
        before: '<div class="cta-box">',
        alt: '받침을 틀리면 받침을 한 번 더 듣고 살펴보라고 알려 주는 채점 화면' },
    ],
    naver: {
      title: '받아쓰기 받침 틀리는 이유 | ㅅ ㅆ ㄲ 겹받침 쉽게 구분하는 법',
      intro: '받아쓰기에서 가장 많이 막히는 건 받침이에요. 왜 헷갈리는지, 외우지 않고 구분하는 방법은 무엇인지 쉽게 풀어 봤어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 받침만 골라 연습해 보고 싶다면 아래 앱도 써 보세요.',
      tags: ['받아쓰기받침', '초등받침', '받침틀리는이유', '겹받침', '초등맞춤법', '받아쓰기', '초등받아쓰기', '맞춤법', '초등학습', '받아쓰기공책'],
    },
  },
  {
    src: '06-dictation-app-guide.html',
    cover: { l1: '받아쓰기 공책', l2: '소개와 사용법', sub: '아이는 혼자 쓰고, 부모는 리포트로', chars: ['공', '책'] },
    images: [
      { file: 'A-step-list', name: '01-step-list', size: PHONE,
        before: '<h3 data-ke-size="size23">2. 소리를 듣고 원고지 칸에 씁니다</h3>',
        alt: '받아쓰기 공책 단계 목록과 연습하기 시험 보기 듣고 고르기 버튼' },
      { file: 'D-write-typing', name: '02-write-on-wongoji', size: WIDE,
        before: '<h3 data-ke-size="size23">3. 제출하기 전에 한 번 더 확인합니다</h3>',
        alt: '원고지 칸에 띄어쓰기 한 칸을 비우고 받아쓰기 문장을 쓰는 화면' },
      { file: 'E-confirm', name: '03-confirm-before-submit', size: WIDE,
        before: '<h3 data-ke-size="size23">4. 틀린 곳을 짚어 줍니다</h3>',
        alt: '제출하기 전에 이대로 제출할까요 하고 한 번 더 확인하는 화면' },
      { file: 'G-batchim-error', name: '04-grading', size: WIDE,
        before: '<h2 data-ke-size="size26">틀린 문제는 오답노트에 쌓여요</h2>',
        alt: '내가 쓴 글자와 정답 글자를 위아래로 겹쳐 틀린 곳을 짚어 주는 채점 화면' },
      { file: 'H-wrong-notes', name: '05-wrong-notes', size: PHONE,
        before: '<h2 data-ke-size="size26">부모님은 리포트로 확인해요</h2>',
        alt: '별 두 개를 모아야 졸업하는 오답노트 화면' },
      { file: 'I-report-types', name: '06-report-types', size: PHONE,
        before: '<h2 data-ke-size="size26">문제는 어떻게 넣나요</h2>',
        alt: '부모용 리포트에서 띄어쓰기 자음 받침 모음 오답 종류를 막대로 보여 주는 화면' },
    ],
    naver: {
      title: "초등 받아쓰기 앱 '받아쓰기 공책' 소개 | 아이 혼자 듣고 쓰고 채점받아요",
      intro: "받아쓰기를 매번 불러 주고 채점해 주는 일이 힘드셨다면, 아이가 혼자 해 볼 수 있는 앱이 있어요. 직접 만든 '받아쓰기 공책'이 어떻게 쓰이는지 화면과 함께 소개합니다.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 궁금한 점은 댓글로 남겨 주세요.',
      tags: ['받아쓰기앱', '초등받아쓰기앱', '받아쓰기공책', '받아쓰기연습', '초등학습앱', '맞춤법앱', '받아쓰기혼자', '초등1학년', '초등공부', '학습습관'],
    },
  },
  {
    src: '07-spacing-mistakes-practice.html',
    cover: { l1: '띄어쓰기 자꾸', l2: '틀리는 아이', sub: '원고지 빈 칸으로 연습하는 법', chars: ['띄', '어'] },
    images: [
      { file: 'F-spacing-error', name: '01-spacing-grading', size: WIDE,
        before: '<div class="cta-box">',
        alt: '작은 발자국을 붙여 쓴 띄어쓰기 오류를 V 표식으로 짚어 주는 채점표' },
    ],
    naver: {
      title: '초등 띄어쓰기 연습법 | 받아쓰기에서 띄어쓰기 자꾸 틀리는 아이',
      intro: '글자는 다 맞는데 받아쓰기 점수가 깎인다면 띄어쓰기 때문일 수 있어요. 띄어쓰기는 규칙 몇 가지만 알면 줄어드는 영역이라, 아이 말로 쉽게 풀어 정리했습니다.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 띄어쓰기를 빈 칸으로 눈에 익히는 연습은 아래 앱에서도 해 볼 수 있어요.',
      tags: ['띄어쓰기', '초등띄어쓰기', '띄어쓰기연습', '받아쓰기띄어쓰기', '초등맞춤법', '받아쓰기', '초등받아쓰기', '맞춤법', '초등학습', '받아쓰기공책'],
    },
  },
  {
    src: '08-dwae-vs-doe-spelling.html',
    cover: { l1: '되 / 돼', l2: '한 번에 구분하기', sub: "'되어'를 넣어 보면 바로 알아요", chars: ['되', '돼'] },
    images: [],
    naver: {
      title: "되 돼 구분법 | '되어'를 넣어 보면 바로 알 수 있어요 (초등 맞춤법)",
      intro: "되와 돼는 어른도 자주 헷갈리는 맞춤법이에요. 외우지 않고 '되어'를 넣어 보는 방법만 알면 바로 구분할 수 있어서, 아이에게 그대로 알려 줄 수 있게 정리했어요.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.',
      tags: ['되돼구분', '되돼', '돼와되', '초등맞춤법', '맞춤법', '헷갈리는맞춤법', '초등받아쓰기', '초등학습', '받아쓰기', '받아쓰기공책'],
    },
  },
  {
    src: '09-why-two-stars-graduation.html',
    cover: { l1: '두 번 연속', l2: '맞혀야 졸업', sub: '오답노트를 이렇게 만든 이유', chars: ['졸', '업'] },
    images: [
      { file: 'H-wrong-notes', name: '01-wrong-notes', size: PHONE,
        before: '<div class="cta-box">',
        alt: '별 두 개를 모아야 졸업하는 오답노트 화면' },
    ],
    naver: {
      title: '오답노트, 왜 두 번 연속 맞혀야 졸업일까 | 받아쓰기 앱을 만들며 한 고민',
      intro: "받아쓰기 앱의 오답노트를 만들면서 가장 오래 고민한 규칙이 있어요. 바로 '두 번 연속 맞혀야 졸업'입니다. 왜 이렇게 정했는지 이야기해 볼게요.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 궁금한 점은 댓글로 남겨 주세요.',
      tags: ['오답노트', '오답노트만들기', '받아쓰기오답노트', '틀린문제복습', '초등학습', '초등받아쓰기', '받아쓰기앱', '사이드프로젝트', '앱만들기', '받아쓰기공책'],
    },
  },
  {
    src: '10-why-wongoji-dictation-app.html',
    cover: { l1: '원고지에 쓰는', l2: '받아쓰기 앱', sub: '만든 이유와 칸의 힘', chars: ['원', '고'] },
    images: [
      { file: 'C-write-empty', name: '01-empty-wongoji', size: WIDE,
        before: '<h2 data-ke-size="size26">채점도 칸으로 보여 줘요</h2>',
        alt: '소리를 듣고 쓰는 빈 원고지 받아쓰기 화면' },
      { file: 'D-write-typing', name: '02-write-on-wongoji', size: WIDE,
        before: '<h2 data-ke-size="size26">원고지 규칙도 그대로 살렸어요</h2>',
        alt: '원고지 칸에 띄어쓰기 한 칸을 비우고 받아쓰기 문장을 쓰는 화면' },
      { file: 'F-spacing-error', name: '03-spacing-grading', size: WIDE,
        before: '<h2 data-ke-size="size26">그 밖에 지킨 것들</h2>',
        alt: '작은 발자국을 붙여 쓴 띄어쓰기 오류를 V 표식으로 짚어 주는 채점표' },
    ],
    naver: {
      title: '받아쓰기 앱을 원고지로 만든 이유 | 띄어쓰기가 빈 칸으로 보여요',
      intro: "'여보, 받아쓰기 좀 불러 줘!'에서 시작한 앱인데, 키보드가 아니라 원고지 칸에 쓰게 만들었어요. 왜 그랬는지, 만들면서 고집한 것들을 정리했습니다.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 원고지 칸에 써 보는 느낌이 궁금하다면 아래 앱을 열어 보세요.',
      tags: ['원고지', '원고지쓰기', '받아쓰기앱', '받아쓰기공책', '초등받아쓰기', '초등학습', '띄어쓰기', '사이드프로젝트', '앱만들기', '만든이야기'],
    },
  },
  {
    src: '11-ae-e-homophone-spelling.html',
    cover: { l1: '개 / 게, 새 / 세', l2: '내 / 네 구분', sub: '귀로 못 가리는 맞춤법', chars: ['개', '게'] },
    images: [],
    naver: {
      title: '개 게 새 세 내 네 구분법 | 소리가 같은 초등 맞춤법 쉽게 알려 주기',
      intro: '개와 게, 새와 세는 말로 하면 소리가 거의 같아서 귀로는 구분이 안 돼요. 소리가 아니라 뜻으로 구분하는 방법을 아이에게 그대로 알려 줄 수 있게 정리했어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.',
      tags: ['개게', '새세', '내네', '헷갈리는맞춤법', '초등맞춤법', '맞춤법', '초등받아쓰기', '초등학습', '받아쓰기', '받아쓰기공책'],
    },
  },
  {
    src: '12-waen-vs-wen-spelling.html',
    cover: { l1: '웬 / 왠', l2: '딱 하나만 기억', sub: '웬일 · 웬만하면 · 왠지', chars: ['왠', '지'] },
    images: [],
    naver: {
      title: '웬 왠 차이 | 왠은 왠지 하나만 외우면 끝 (초등 맞춤법)',
      intro: "'웬'과 '왠'은 발음이 같아서 어른도 자주 틀려요. 그런데 구분은 의외로 간단합니다. 딱 하나만 기억하면 되는 방법을 아이에게 그대로 알려 줄 수 있게 정리했어요.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.',
      tags: ['웬왠', '웬왠차이', '왠지웬지', '웬일', '웬만하면', '초등맞춤법', '헷갈리는맞춤법', '맞춤법', '받아쓰기', '받아쓰기공책'],
    },
  },
  {
    src: '13-saisiot-rule-spelling.html',
    cover: { l1: '사이시옷', l2: '촛불 · 인사말', sub: '붙이는 때와 안 붙이는 때', chars: ['촛', '불'] },
    images: [],
    naver: {
      title: '사이시옷 규칙 | 촛불은 ㅅ이 있고 인사말은 없는 이유',
      intro: '촛불과 바닷가에는 ㅅ을 쓰는데 인사말에는 왜 안 쓸까요? 한 가지 질문만 던지면 구분이 됩니다. 아이에게 그대로 알려 줄 수 있게 사이시옷 규칙을 정리했어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 사이시옷 문제를 문장 속에서 풀어 보고 싶다면 아래 앱을 열어 보세요.',
      tags: ['사이시옷', '사이시옷규칙', '촛불', '바닷가', '인사말', '초등맞춤법', '헷갈리는맞춤법', '맞춤법', '받아쓰기', '받아쓰기공책'],
    },
  },
  {
    src: '14-adult-common-spelling-mistakes.html',
    cover: { l1: '어른도 틀리는', l2: '맞춤법 8가지', sub: '며칠 · 오랜만 · 봬요', chars: ['며', '칠'] },
    images: [],
    naver: {
      title: '자주 틀리는 맞춤법 | 며칠 오랜만 설거지 봬요 아니에요 정리',
      intro: '아이 받아쓰기를 봐 주다가 어른이 먼저 멈칫한 낱말들이 있었어요. 매일 쓰는 말인데 막상 쓰려면 헷갈리는 맞춤법 8가지를 이유와 함께 모았습니다.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 아이와 같이 맞춤법 문제를 풀어 보고 싶다면 아래 앱도 한번 열어 보세요.',
      tags: ['자주틀리는맞춤법', '헷갈리는맞춤법', '며칠', '오랜만', '설거지', '봬요', '아니에요', '어른맞춤법', '맞춤법', '받아쓰기공책'],
    },
  },
  {
    src: '15-an-vs-anh-spelling.html',
    cover: { l1: '안 / 않', l2: '아니 vs 아니하', sub: '초등 맞춤법', chars: ['안', '않'] },
    images: [],
    naver: {
      title: '안 않 구분법 | 아니와 아니하를 넣어 보면 바로 알아요',
      intro: "'안 먹어요'와 '먹지 않아요'는 둘 다 맞는데 왜 다를까요? 외울 필요 없이 어떤 말이 줄어든 건지 알면 구분됩니다. 아이에게 그대로 알려 줄 수 있게 정리했어요.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 안/않 문제를 문장 속에서 풀어 보는 연습은 아래 앱에서 해 볼 수 있어요.',
      tags: ['안않', '안않구분', '안과않', '않았어요', '안했어요', '초등맞춤법', '헷갈리는맞춤법', '맞춤법', '받아쓰기', '받아쓰기공책'],
    },
  },
  {
    src: '16-de-vs-dae-spelling.html',
    cover: { l1: '데 / 대', l2: '본 것과 들은 것', sub: '재밌데 · 맛있대', chars: ['데', '대'] },
    images: [],
    naver: {
      title: '데 대 차이 | 재밌데와 맛있대, 직접 본 것과 들은 것',
      intro: "'그 영화 재밌데'와 '그 영화 재밌대'는 한 글자 차이인데 뜻이 달라요. 문자나 댓글을 쓰다 멈칫하는 맞춤법을 내가 겪은 건지 들은 건지만 따져서 구분하는 방법으로 정리했어요.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 데/대 문제를 문장 속에서 직접 골라 보고 싶다면 아래 앱을 열어 보세요.',
      tags: ['데대', '데대구분', '데대차이', '재밌데', '맛있대', '초등맞춤법', '헷갈리는맞춤법', '맞춤법', '받아쓰기', '받아쓰기공책'],
    },
  },
  {
    src: '17-dictation-practice-sentences-grade2.html',
    cover: { l1: '2학년 받아쓰기', l2: '연습 문장 20개', sub: '받침 · 띄어쓰기 포인트', chars: ['받', '쓰'] },
    images: [],
    naver: {
      title: '2학년 받아쓰기 문장 20개 | 겹받침 사이시옷 띄어쓰기 연습',
      intro: '2학년이 되면 받아쓰기 문장이 길어지고 겹받침과 사이시옷이 많이 나와요. 집에서 불러 줄 수 있는 문장 20개와 문장마다 짚어야 할 포인트를 정리했습니다.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 소리를 듣고 원고지에 직접 써 보는 연습은 아래 앱에서 아이 혼자 할 수 있어요.',
      tags: ['2학년받아쓰기', '초등2학년받아쓰기', '받아쓰기문장', '받아쓰기연습', '초2받아쓰기', '받아쓰기급수', '초등학습', '겹받침', '띄어쓰기', '받아쓰기공책'],
    },
  },
  {
    src: '18-food-name-spelling.html',
    cover: { l1: '음식 이름', l2: '맞춤법 6가지', sub: '찌개 · 떡볶이 · 곱빼기', chars: ['찌', '개'] },
    images: [],
    naver: {
      title: '찌개 찌게 떡볶이 떡볶기 | 헷갈리는 음식 이름 맞춤법 6가지',
      intro: '메뉴판은 맞춤법 시험장이에요. 말로는 쉬운데 글자로 쓰면 헷갈리는 음식 이름들, 소리 나는 대로 쓰면 틀리는 6가지를 이유와 함께 정리했어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 음식 이름 맞춤법을 문장 속에서 풀어 보고 싶다면 아래 앱을 열어 보세요.',
      tags: ['음식맞춤법', '찌개찌게', '떡볶이떡볶기', '곱빼기', '육개장', '깍두기', '뚝배기', '초등맞춤법', '맞춤법', '받아쓰기공책'],
    },
  },
  {
    src: '19-homophone-spelling-2.html',
    cover: { l1: '짖다 / 짓다', l2: '같다 / 갔다', sub: '소리가 같은 맞춤법 2탄', chars: ['짖', '짓'] },
    images: [],
    naver: {
      title: '짖다 짓다 같다 갔다 | 소리가 같아서 헷갈리는 초등 맞춤법',
      intro: "'강아지가 짖어요'와 '밥을 지어요', '키가 같아요'와 '학교에 갔어요'는 귀로는 구분이 안 돼요. 소리 말고 뜻으로 구분하는 방법으로 정리했어요.",
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.',
      tags: ['짖다짓다', '같다갔다', '짖어요지어요', '동음이의어', '초등맞춤법', '헷갈리는맞춤법', '맞춤법', '받아쓰기', '초등학습', '받아쓰기공책'],
    },
  },
  {
    src: '20-nat-da-vs-nah-da-spelling.html',
    cover: {"l1":"낫다 / 낳다","l2":"나았다 vs 낳았다","sub":"초등 맞춤법","chars":["낫","낳"]},
    images: [],
    naver: {
      title: "낫다 낳다 차이 | 감기가 나았어요 vs 새끼를 낳았어요",
      intro: "'감기가 나았어요'와 '새끼를 낳았어요'는 소리가 같아서 받아쓰기에서 자주 틀려요. 소리 말고 뜻으로 구분하는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 낫다/낳다 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["낫다낳다","낫다낳다구분","나았어요낳았어요","감기가나았어요","아기를낳다","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '21-itaga-vs-itdaga-spelling.html',
    cover: {"l1":"이따가 / 있다가","l2":"나중에로 바꿔요","sub":"초등 맞춤법","chars":["따","다"]},
    images: [],
    naver: {
      title: "이따가 있다가 차이 | 나중에로 바꿔 보면 바로 알아요",
      intro: "'이따가 만나요'일까 '있다가 만나요'일까요? 나중에로 바꿔 보는 한 가지 방법으로 구분하는 법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 이따가/있다가 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["이따가있다가","이따가","있다가","이따봐","이따가와있다가차이","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '22-eotteoke-vs-eotteokhae-spelling.html',
    cover: {"l1":"어떻게 / 어떡해","l2":"어떻해는 틀려요","sub":"초등 맞춤법","chars":["어","떡"]},
    images: [],
    naver: {
      title: "어떻게 어떡해 차이 | 문장이 끝나면 어떡해",
      intro: "어떻게와 어떡해, 어떻해 중 뭐가 맞을까요? 뒤에 말이 이어지는지만 보면 구분되는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 어떻게/어떡해 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["어떻게어떡해","어떡해","어떻게","어떻해","어떻게해","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '23-roseo-vs-rosseo-spelling.html',
    cover: {"l1":"로서 / 로써","l2":"자격 vs 도구","sub":"초등 맞춤법","chars":["서","써"]},
    images: [],
    naver: {
      title: "로서 로써 차이 | 자격이면 로서, 도구면 로써",
      intro: "'학생으로서'일까 '학생으로써'일까요? 자격인지 도구인지만 물어보면 바로 구분되는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 로서/로써 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["로서로써","로서","로써","로서와로써차이","학생으로서","말로써","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '24-matchida-vs-matchuda-spelling.html',
    cover: {"l1":"맞히다 / 맞추다","l2":"정답 vs 퍼즐","sub":"초등 맞춤법","chars":["맞","추"]},
    images: [],
    naver: {
      title: "맞히다 맞추다 차이 | 정답은 맞히고 퍼즐은 맞춰요",
      intro: "'정답을 맞췄어요'일까 '맞혔어요'일까요? 정답과 퍼즐로 나눠 보면 헷갈리지 않는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 맞히다/맞추다 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["맞히다맞추다","맞혔어요맞췄어요","정답을맞히다","퍼즐을맞추다","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '25-gareuchida-vs-garikida-spelling.html',
    cover: {"l1":"가르치다/가리키다","l2":"가르키다는 없어요","sub":"초등 맞춤법","chars":["르","리"]},
    images: [],
    naver: {
      title: "가르치다 가리키다 차이 | 가르키다는 틀린 말이에요",
      intro: "'가르켜 주셨어요'는 틀린 말이에요. 가르치다와 가리키다를 선생님과 손가락으로 구분하는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 가르치다/가리키다 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["가르치다가리키다","가르쳐요가리켜요","가르키다","손가락으로가리키다","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '26-dareuda-vs-teullida-spelling.html',
    cover: {"l1":"다르다 / 틀리다","l2":"같다 vs 맞다","sub":"초등 맞춤법","chars":["다","틀"]},
    images: [],
    naver: {
      title: "다르다 틀리다 차이 | 반대말을 떠올리면 바로 알아요",
      intro: "'나랑 생각이 틀려'는 맞는 표현일까요? 반대말이 같다인지 맞다인지 떠올리면 구분되는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 다르다/틀리다 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["다르다틀리다","다르다틀리다차이","틀리다다르다","생각이달라요","받아쓰기틀렸어요","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '27-buchida-vs-butida-spelling.html',
    cover: {"l1":"부치다 / 붙이다","l2":"편지 vs 우표","sub":"초등 맞춤법","chars":["부","붙"]},
    images: [],
    naver: {
      title: "부치다 붙이다 차이 | 편지는 부치고 우표는 붙여요",
      intro: "'편지를 붙였어요'일까 '부쳤어요'일까요? 보내는 일과 맞닿게 하는 일로 구분하는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 부치다/붙이다 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["부치다붙이다","편지를부치다","우표를붙이다","부쳤어요붙였어요","부침개","초등맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '28-gyeolje-vs-gyeoljae-spelling.html',
    cover: {"l1":"결제 / 결재","l2":"돈 vs 도장","sub":"어른도 틀리는 맞춤법","chars":["제","재"]},
    images: [],
    naver: {
      title: "결제 결재 차이 | 돈을 내면 결제, 도장을 받으면 결재",
      intro: "'카드로 결재했어요'는 어디가 틀렸을까요? 어른도 자주 틀리는 결제와 결재를 돈과 도장으로 구분하는 방법을 정리했어요.",
      outro: "도움이 되셨다면 공감과 이웃 추가 부탁드려요. 결제/결재 문제를 문장 속에서 직접 골라 보는 연습은 아래 앱에서 해 볼 수 있어요.",
      tags: ["결제결재","결제결재차이","카드결제","결재받다","결재결제구분","어른맞춤법","헷갈리는맞춤법","받아쓰기공책","맞춤법","받아쓰기"],
    },
  },
  {
    src: '29-dictation-practice-sentences-grade3.html',
    cover: { l1: '3학년 받아쓰기', l2: '연습 문장 20개', sub: '받침 · 사이시옷 · 띄어쓰기', chars: ['받', '쓰'] },
    images: [],
    naver: {
      title: '3학년 받아쓰기 문장 20개 | 겹받침 사이시옷 띄어쓰기 연습',
      intro: '3학년 받아쓰기는 문장이 길어지고 겹받침과 사이시옷이 자주 나와요. 집에서 불러 주기 좋은 문장 20개를 문장마다 짚을 포인트와 함께 정리했어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 아이 혼자 듣고 원고지에 써서 채점받는 연습은 아래 앱에서 해 볼 수 있어요.',
      tags: ['3학년받아쓰기', '초등3학년받아쓰기', '받아쓰기문장', '받아쓰기연습', '초3받아쓰기', '받아쓰기급수', '초등학습', '받아쓰기공책', '받아쓰기'],
    },
  },
  {
    src: '30-dictation-test-eve-prep.html',
    cover: { l1: '받아쓰기 시험 전날', l2: '15분 준비법', sub: '틀린 문장만 다시', chars: ['받', '쓰'] },
    images: [],
    naver: {
      title: '받아쓰기 시험 전날 준비법 | 15분이면 충분해요',
      intro: '받아쓰기 시험 전날, 문장을 잔뜩 불러 주고 있지는 않나요? 새로 외우는 것보다 이미 틀린 곳을 다시 보는 쪽이 낫습니다. 15분 루틴으로 정리했어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 틀린 문장만 모아 다시 풀어 보는 오답노트는 아래 앱에서 해 볼 수 있어요.',
      tags: ['받아쓰기시험전날', '받아쓰기준비', '받아쓰기공부법', '받아쓰기시험', '받아쓰기100점', '초등받아쓰기', '초등학습', '받아쓰기공책', '받아쓰기'],
    },
  },
  {
    // 네이버 AI 브리핑의 「띄어쓰기 연습 앱」을 겨냥한 글. 앱 이름을 늘어놓지 않고 종류로만 견줍니다 —
    // 남의 앱 가격·기능은 자주 바뀌어 틀린 정보가 되기 쉽고, 이름을 다 적으면 남의 앱 소개 글이 됩니다.
    src: '31-spacing-practice-app.html',
    cover: { l1: '띄어쓰기 연습 앱', l2: '고르는 법', sub: '고르는 앱보다 직접 쓰는 앱', chars: ['띄', '어'] },
    images: [
      { file: 'D-write-typing', name: '01-write-on-wongoji', size: WIDE,
        before: '<h2 data-ke-size="size26">한눈에 비교하면</h2>',
        alt: '원고지 칸에 띄어쓰기 한 칸을 비우고 받아쓰기 문장을 쓰는 화면' },
      { file: 'F-spacing-error', name: '02-spacing-grading', size: WIDE,
        before: '<h2 data-ke-size="size26">자주 묻는 질문</h2>',
        alt: '작은 발자국을 붙여 쓴 띄어쓰기 오류를 V 표식으로 짚어 주는 채점표' },
    ],
    naver: {
      title: '띄어쓰기 연습 앱 | 초등 저학년은 고르는 앱보다 직접 쓰는 앱이 좋은 이유',
      intro: '아이 띄어쓰기 연습 앱을 찾고 계신가요? 초등 저학년이라면 보기를 고르는 앱보다 소리를 듣고 직접 써 보는 앱이 받아쓰기 시험에 더 가까워요. 고를 때 볼 세 가지와, 앱 종류별 차이를 정리했어요.',
      outro: '도움이 되셨다면 공감과 이웃 추가 부탁드려요. 원고지에 직접 써 보면 띄어쓰기를 어떻게 짚어 주는지 바로 알 수 있어요. 가입 없이 한 문장 써 보세요.',
      tags: ['띄어쓰기연습앱', '띄어쓰기앱', '띄어쓰기연습', '초등띄어쓰기', '받아쓰기앱', '초등받아쓰기', '초등맞춤법', '초등학습앱', '받아쓰기연습', '받아쓰기공책'],
    },
  },
];

/* ---------- 대표 이미지 ---------- */
function cell(x, y, size, ch) {
  const mid = x + size / 2;
  return `
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="10" fill="#ffffff" stroke="${GRID}" stroke-width="4"/>
  <line x1="${mid}" y1="${y}" x2="${mid}" y2="${y + size}" stroke="${GRID_FAINT}" stroke-width="1.5"/>
  <line x1="${x}" y1="${y + size / 2}" x2="${x + size}" y2="${y + size / 2}" stroke="${GRID_FAINT}" stroke-width="1.5"/>
  <text x="${mid}" y="${y + size * 0.74}" font-family="${SERIF}" font-size="${size * 0.66}" font-weight="700"
        fill="${INK}" text-anchor="middle">${ch}</text>`;
}

function coverSvg({ l1, l2, sub, chars }) {
  const W = 1200;
  const H = 630;
  const rules = [];
  for (let y = 50; y < H; y += 50) rules.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#efeadc" stroke-width="1"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${rules.join('\n  ')}
  <rect x="34" y="34" width="${W - 68}" height="${H - 68}" rx="22" fill="none" stroke="${GRID_FAINT}" stroke-width="3"/>
  <rect x="34" y="34" width="14" height="${H - 68}" rx="7" fill="${GRID}"/>
  <text x="96" y="262" font-family="${SERIF}" font-size="80" font-weight="700" fill="${INK}">${l1}</text>
  <text x="96" y="362" font-family="${SERIF}" font-size="80" font-weight="700" fill="${GRID_DEEP}">${l2}</text>
  <text x="98" y="432" font-family="${SANS}" font-size="32" fill="${INK_SOFT}">${sub}</text>
  ${cell(810, 215, 150, chars[0])}
  ${cell(980, 215, 150, chars[1])}
  <rect x="98" y="520" width="38" height="38" rx="5" fill="#ffffff" stroke="${GRID}" stroke-width="3"/>
  <text x="117" y="548" font-family="${SERIF}" font-size="24" font-weight="700" fill="${INK}" text-anchor="middle">작</text>
  <text x="152" y="548" font-family="${SANS}" font-size="26" fill="${INK_SOFT}">이여꾸의 작업실 · 받아쓰기 공책</text>
</svg>`;
}

/* ---------- 원본 읽기 ---------- */
function parseSource(file) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
  const m = raw.match(/^<!--([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${file}: 맨 위 발행 정보 주석이 없습니다`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^\s*(제목|카테고리|주소\(슬러그\)|태그)\s*:\s*(.+?)\s*$/);
    if (mm) meta[mm[1]] = mm[2];
  }
  let body = raw.slice(m[0].length).replace(/<!--\s*이미지:[\s\S]*?-->\s*/g, '');
  return { meta, body };
}

/* ---------- 표식 넣기 ---------- */
function insertMarkers(body, images) {
  let out = `<!--IMG:0-->\n` + body;
  images.forEach((img, i) => {
    const idx = out.indexOf(img.before);
    if (idx < 0) throw new Error(`삽입 위치를 못 찾았습니다: ${img.before.slice(0, 40)}`);
    out = out.slice(0, idx) + `<!--IMG:${i + 1}-->\n` + out.slice(idx);
  });
  return out;
}

function placeholder(n, label, alt, size, naver) {
  const tag = n === 0 ? '대표 이미지' : `이미지 ${n}`;
  const note = n === 0 ? ' (글 맨 위에 올리면 대표 이미지가 됩니다)' : '';
  const style = 'margin:24px 0;padding:14px 16px;border:2px dashed #c9902a;background:#faf1dc;color:#7a5410;font-size:15px;line-height:1.7;';
  const where = naver ? '' : ' data-ke-size="size16"';
  return `<p${where} style="${style}">▶ [${tag}] ${label} 를 여기에 올려 주세요${note} · 대체텍스트: ${alt} · 크기: ${size} (이 상자는 이미지를 올린 뒤 지우세요)</p>`;
}

function fillMarkers(html, items, naver) {
  return html.replace(/<!--IMG:(\d+)-->\n?/g, (_, d) => {
    const n = Number(d);
    const it = items[n];
    return placeholder(n, it.label, it.alt, it.size, naver) + '\n';
  });
}

/*
  ---------- 네이버 스마트에디터용 (naver-editor.html) ----------
  스마트에디터는 붙여 넣은 HTML 의 margin·padding·border·background 를 버립니다.
  (예전 naver.html 은 인라인 스타일로 소제목 밑줄·문단 간격·상자를 만들었는데 그래서 다 사라졌습니다 — 없앴습니다.)
  남는 것은 굵게·글자 크기·색·링크·줄바꿈 정도라, 간격은 **빈 문단**으로 직접 만들고
  소제목은 굵은 큰 글씨로, 목록은 「• 」 문단으로, 상자는 문단 묶음으로 풀어 씁니다.
  2026-10-21 09번으로 붙여 확인했고(간격·소제목·목록 정상) 이게 네이버용 정식 파일입니다.
*/
const BL = '<p><br></p>';
function toNaverEditor(html, naverCfg) {
  let h = html;
  h = h.replace(/<p data-ke-size="size16">[\s\S]*?<\/p>/, `<p data-ke-size="size16">${naverCfg.intro}</p>`);
  const outro = `<p data-ke-size="size16">${naverCfg.outro}</p>\n`;
  const rel = '<h2 data-ke-size="size26">함께 보면 좋은 글</h2>';
  if (!h.includes(rel)) throw new Error('함께 보면 좋은 글 제목을 못 찾았습니다');
  h = h.replace(rel, outro + rel);
  h = h.split('utm_source=tistory').join('utm_source=naver');
  h = h.replace(/<li><a href="\/entry\/[^"]+">([\s\S]*?)<\/a><\/li>/g, '<li>$1</li>');

  h = h.replace(/<div class="cta-box">([\s\S]*?)<\/div>/g, (_, inner) => {
    const strong = (inner.match(/<strong>([\s\S]*?)<\/strong>/) || ['', ''])[1];
    const p = (inner.match(/<p>([\s\S]*?)<\/p>/) || ['', ''])[1];
    const a = inner.match(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) || ['', '', ''];
    return `${BL}<p><b><span style="font-size:19px;color:#1f5a41;">${strong}</span></b></p><p>${p}</p><p><a href="${a[1]}">${a[2]} →</a></p>${BL}`;
  });
  h = h.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_, t) => {
    const cells = (tr) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    const head = cells((t.match(/<thead>([\s\S]*?)<\/thead>/) || ['', ''])[1]);
    const body = (t.match(/<tbody>([\s\S]*?)<\/tbody>/) || ['', ''])[1];
    let rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => cells(m[1]));
    if (head[0] === '번호') rows = rows.map((r) => r.slice(1));
    // 칸이 넷 이상인 비교표는 칸 이름을 붙여 씁니다 — 안 붙이면 「✕ — ✕ — ○」만 남아 무엇이 ✕ 인지 모릅니다
    if (head[0] !== '번호' && head.length >= 4) {
      return rows.map((r) => `<p>• <b>${r[0]}</b> — ${r.slice(1).map((c, i) => `${head[i + 1]} ${c}`).join(' · ')}</p>`).join('') + BL;
    }
    return rows.map((r) => `<p>• ${r.join(' — ')}</p>`).join('') + BL;
  });
  h = h
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, t) => `${BL}<p><b><span style="font-size:24px;color:#232b33;">${t}</span></b></p>${BL}`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, t) => `${BL}<p><b><span style="font-size:19px;color:#1f5a41;">${t}</span></b></p>`)
    .replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/g, (_, tag, inner) => {
      let n = 0;
      return [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
        .map((m) => `<p>${tag === 'ol' ? ++n + '. ' : '• '}${m[1].trim()}</p>`)
        .join('') + BL;
    })
    .replace(/<p data-ke-size="size16">([\s\S]*?)<\/p>/g, (_, t) => `<p>${t}</p>${BL}`);
  return h;
}

function placeholderEditor(n, label, alt, size) {
  const tag = n === 0 ? '대표 이미지' : `이미지 ${n}`;
  const note = n === 0 ? ' (글 맨 위에 올리면 대표 이미지가 됩니다)' : '';
  return `<p><b><span style="background-color:#faf1dc;color:#7a5410;">▶ [${tag}] ${label} 를 여기에 올려 주세요${note} · 대체텍스트: ${alt} · 크기: ${size} (이 줄은 이미지를 올린 뒤 지우세요)</span></b></p>`;
}

/* ---------- 네이버용 텍스트 버전 (서식 붙여 넣기가 안 될 때) ---------- */
function toPlain(html, naverCfg, items) {
  let h = html;
  h = h.replace(/<p data-ke-size="size16">[\s\S]*?<\/p>/, '<p>' + naverCfg.intro + '</p>');
  h = h.replace(/<li><a href="\/entry\/[^"]+">([\s\S]*?)<\/a><\/li>/g, '<li>$1</li>');
  h = h.replace(/<!--IMG:(\d+)-->\n?/g, (_, d) => {
    const n = Number(d);
    return `\n[사진 ${n === 0 ? '대표' : n}: ${items[n].label} 를 여기에 올리기]\n`;
  });
  h = h.replace(/<div class="cta-box">([\s\S]*?)<\/div>/g, (_, inner) => {
    const strong = (inner.match(/<strong>([\s\S]*?)<\/strong>/) || ['', ''])[1];
    const p = (inner.match(/<p>([\s\S]*?)<\/p>/) || ['', ''])[1];
    const a = inner.match(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) || ['', '', ''];
    return `\n※ ${strong}\n${p}\n${a[2]} → ${a[1].replace('utm_source=tistory', 'utm_source=naver')}\n`;
  });
  // 표는 에디터에서 다시 그리기 번거로워서 「열 이름: 값」 목록으로 풀어 씁니다.
  h = h.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_, t) => {
    const cells = (tr) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    const head = cells((t.match(/<thead>([\s\S]*?)<\/thead>/) || ['', ''])[1]);
    const body = (t.match(/<tbody>([\s\S]*?)<\/tbody>/) || ['', ''])[1];
    let rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => cells(m[1]));
    if (head[0] === '번호') rows = rows.map((r) => r.slice(1)); // 번호 칸은 목록 기호가 대신합니다
    if (head[0] !== '번호' && head.length >= 4) {
      return '\n' + rows.map((r) => `- ${r[0]} — ${r.slice(1).map((c, i) => `${head[i + 1]} ${c}`).join(' · ')}`).join('\n') + '\n';
    }
    return '\n' + rows.map((r) => '- ' + r.join(' — ')).join('\n') + '\n';
  });
  h = h
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n\n■ $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n▶ $1\n')
    .replace(/<\/tr>/g, '\n')
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/g, ' | ')
    .replace(/<li[^>]*>/g, '- ')
    .replace(/<\/li>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  h = h.split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n\n(?=- )/g, '\n').trim();
  h = h.replace(/(^|\n)(?=■ )/g, '$1\n').replace(/\n{3,}/g, '\n\n');
  return h + '\n';
}

/* ---------- 발행 안내 ---------- */
function guide({ meta, naver, items, folder }) {
  const rows = items
    .map((it, n) => `| ${n === 0 ? '대표' : n} | \`images/${it.out}\` | ${n === 0 ? '글 맨 위' : it.where} | ${it.alt} | ${it.size} |`)
    .join('\n');
  return `# ${meta['제목']}

## 티스토리
- 제목: ${meta['제목']}
- 카테고리: ${meta['카테고리']}
- 주소(슬러그): ${meta['주소(슬러그)']}  ← 글끼리 링크가 이 주소를 씁니다. 반드시 그대로
- 태그: ${meta['태그']}
- 방법: 글쓰기 → [기본모드 → HTML] → \`tistory.html\` **전체**를 복사해 붙여 넣기 → 기본모드로 돌아와서 노란 상자 자리에 이미지를 올리고 상자는 지우기
- 주의: 이 파일에는 발행 정보 주석이 없습니다. 제목·카테고리·슬러그·태그는 이 문서를 보고 직접 입력하세요.

## 네이버 블로그
- 제목: ${naver.title}
- 태그(10개): ${naver.tags.map((t) => '#' + t).join(' ')}
- 방법: \`naver-editor.html\`을 Chrome으로 열기 → Ctrl+A, Ctrl+C → 스마트에디터에서 Ctrl+V → 배경색이 칠해진 「▶ [이미지 …]」 줄 자리에 이미지를 올리고 그 줄은 지우기
- 맨 위 이미지(대표)를 **대표 사진**으로 지정
- 티스토리에 올린 뒤 **3일 이상 지나서** 올리세요 (같은 내용을 같은 날 올리면 중복 문서로 밀릴 수 있습니다)
- 「함께 보면 좋은 글」은 네이버에 올린 다른 글 주소로 직접 연결하세요

## 이미지 (올릴 순서)
| 번호 | 파일 | 위치 | 대체텍스트(설명) | 크기 |
|---|---|---|---|---|
${rows}
`;
}

/* ---------- 실행 ---------- */
(async () => {
  // `--only=09` 처럼 글 번호로 한 편만 뽑습니다. 이미 올린 글의 파일을 건드리지 않으려는 용도입니다.
  const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
  for (const p of POSTS) {
    if (ONLY && !p.src.startsWith(ONLY)) continue;
    const { meta, body } = parseSource(p.src);
    const slug = meta['주소(슬러그)'];
    const dir = path.join(OUT, p.src.replace(/\.html$/, ''));
    fs.mkdirSync(path.join(dir, 'images'), { recursive: true });

    // 이미지 복사 + 대표 이미지
    const items = [{ label: '00-cover.png', out: '00-cover.png', alt: `${meta['제목']} 대표 이미지`, size: '1200x630, 글 맨 위', where: '글 맨 위' }];
    await sharp(Buffer.from(coverSvg(p.cover))).png().toFile(path.join(dir, 'images/00-cover.png'));
    for (const img of p.images) {
      const out = `${img.name}.png`;
      fs.copyFileSync(path.join(READY, `${img.file}.png`), path.join(dir, 'images', out));
      const heading = img.before.replace(/<[^>]+>/g, '');
      const where = heading ? `「${heading}」 바로 위` : '글 끝의 초록 안내 상자 바로 위';
      items.push({ label: out, out, alt: img.alt, size: img.size, where });
    }

    const marked = insertMarkers(body, p.images);

    // 티스토리
    // 주석을 본문에 넣으면 티스토리가 그 글자를 검색 설명(meta description)과 목록 요약으로 씁니다.
    // 그래서 발행 정보는 발행-안내.md 에만 두고 tistory.html 은 본문만 담습니다.
    fs.writeFileSync(path.join(dir, 'tistory.html'), fillMarkers(marked, items, false));

    // 네이버 (스마트에디터용 — 간격·소제목을 에디터가 버리지 않는 방식)
    const editorBody = toNaverEditor(marked, p.naver).replace(/<!--IMG:(\d+)-->\n?/g, (_, d) => {
      const n = Number(d);
      return placeholderEditor(n, items[n].label, items[n].alt, items[n].size) + '\n' + BL;
    });
    fs.writeFileSync(
      path.join(dir, 'naver-editor.html'),
      `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>${p.naver.title}</title>\n</head><body>\n${editorBody}\n</body></html>\n`,
    );
    fs.writeFileSync(path.join(dir, 'naver-plain.txt'), p.naver.title + '\n\n' + toPlain(marked, p.naver, items));
    fs.writeFileSync(path.join(dir, '발행-안내.md'), guide({ meta, naver: p.naver, items, folder: dir }));
    console.log('만듦:', path.relative(ROOT, dir));
  }
})();
