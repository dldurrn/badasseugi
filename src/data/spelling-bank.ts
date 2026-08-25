/**
 * 맞춤법 문제은행 (기본 제공)
 *
 * 부모가 만들지 않고 앱이 미리 갖고 있는 문제들입니다.
 * 받아쓰기와 달리 맞춤법은 학교와 무관하게 보편적으로 헷갈리는 항목이라
 * 잘 고른 문제 세트 하나로 충분합니다.
 *
 * 문제 유형
 * - mcq  : 두 표기 중 맞는 것 고르기
 * - fill : 문장 빈칸에 들어갈 말 고르기
 * - find : 문장에서 틀린 낱말 찾아 누르기
 *
 * explanation은 틀렸을 때만 보여줍니다. 규칙을 외우게 하려는 게 아니라
 * "왜 그런지" 한 줄로 납득시키는 용도라 짧게 씁니다.
 *
 * 난이도(level)는 한글 맞춤법·표준어 규정을 근거로 매깁니다.
 * 지금은 화면에서 급수를 고르지 않고 그냥 섞어서 냅니다 — 데이터에만 붙여 두었습니다.
 * 나중에 급수별로 나눠 내고 싶어지면 `pickQuestions`에 level 필터만 더하면 됩니다.
 *
 * 동음이의 낱말(개/게, 새/세, 배/베)은 받아쓰기가 아니라 여기서 다룹니다.
 * 소리만으로는 구분할 수 없지만, 문장 맥락이 있으면 정답이 하나로 정해지기 때문입니다.
 */

export type SpellingKind = 'mcq' | 'fill' | 'find';
export type SpellingLevel = 'basic' | 'inter' | 'advanced';

export interface SpellingQuestion {
  id: string;
  kind: SpellingKind;
  level: SpellingLevel;
  /** mcq·fill: 문제 문장 (fill은 ___ 자리 포함) / find: 검사할 문장 */
  prompt: string;
  /** mcq·fill: 보기 / find: 문장을 낱말로 쪼갠 배열 */
  options: string[];
  /** 정답 (보기 중 하나, 또는 find에서 틀린 낱말) */
  answer: string;
  /**
   * find 전용 — 틀린 낱말을 바르게 고친 표기.
   * find에서 `answer`는 "무엇이 틀렸는지"(문장 속 틀린 낱말)이지 "바른 표기"가 아닙니다.
   * 맞혔을 때도 바른 표기를 확실히 보여줘야 해서 따로 둡니다.
   */
  correction?: string;
  explanation: string;
  tag: string;
}

export const SPELLING_BANK: SpellingQuestion[] = [
  /* ---------------- 되 / 돼 ---------------- */
  {
    id: 'dwae-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '창문을 열면 안 ___.',
    options: ['되', '돼'],
    answer: '돼',
    explanation: '문장 끝에는 "돼"를 써요. "되어"를 줄인 말이에요.',
    tag: '되/돼',
  },
  {
    id: 'dwae-2',
    kind: 'mcq',
    level: 'basic',
    prompt: '이제 그만해도 ___요.',
    options: ['되', '돼'],
    answer: '돼',
    explanation: '"되어요"를 줄이면 "돼요"가 돼요.',
    tag: '되/돼',
  },
  {
    id: 'dwae-3',
    kind: 'mcq',
    level: 'basic',
    prompt: '커서 무엇이 ___고 싶니?',
    options: ['되', '돼'],
    answer: '되',
    explanation: '"되고"는 "되-"에 "-고"가 붙은 말이라 "되"를 써요. "돼"는 "되어"를 줄인 말이에요.',
    tag: '되/돼',
  },

  /* ---------------- 왠 / 웬 ---------------- */
  {
    id: 'waen-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '오늘은 ___지 기분이 좋아요.',
    options: ['왠', '웬'],
    answer: '왠',
    explanation: '"왠지"는 "왜인지"가 줄어든 말이라 "왠"을 써요.',
    tag: '왠/웬',
  },
  {
    id: 'waen-2',
    kind: 'mcq',
    level: 'inter',
    prompt: '이게 ___ 떡이야?',
    options: ['왠', '웬'],
    answer: '웬',
    explanation: '"어떤"이라는 뜻일 때는 "웬"을 써요.',
    tag: '왠/웬',
  },

  /* ---------------- 낫다 / 낮다 / 낳다 ---------------- */
  {
    id: 'nat-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '감기가 다 ___어요.',
    options: ['나았', '낳았'],
    answer: '나았',
    explanation: '병이 없어지는 건 "낫다"예요. "낳다"는 아기를 낳을 때 써요.',
    tag: '낫다/낳다',
  },
  {
    id: 'nat-2',
    kind: 'mcq',
    level: 'inter',
    prompt: '고양이가 새끼를 ___어요.',
    options: ['나았', '낳았'],
    answer: '낳았',
    explanation: '새 생명을 세상에 내보내는 건 "낳다"예요.',
    tag: '낫다/낳다',
  },

  /* ---------------- 어떻게 / 어떡해 ---------------- */
  {
    id: 'eotteo-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '이 문제를 ___ 풀까?',
    options: ['어떻게', '어떡해'],
    answer: '어떻게',
    explanation: '"어떤 방법으로"라는 뜻일 때는 "어떻게"예요.',
    tag: '어떻게/어떡해',
  },
  {
    id: 'eotteo-2',
    kind: 'mcq',
    level: 'inter',
    prompt: '준비물을 안 가져왔는데 ___?',
    options: ['어떻게', '어떡해'],
    answer: '어떡해',
    explanation: '"어떻게 해"를 줄이면 "어떡해"가 돼요.',
    tag: '어떻게/어떡해',
  },

  /* ---------------- 며칠 ---------------- */
  {
    id: 'myeochil-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '오늘이 ___이에요?',
    options: ['며칠', '몇일'],
    answer: '며칠',
    explanation: '"몇일"이라는 말은 없어요. 언제나 "며칠"로 써요.',
    tag: '며칠',
  },

  /* ---------------- 안 / 않 ---------------- */
  {
    id: 'an-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '오늘은 학교에 ___ 가요.',
    options: ['안', '않'],
    answer: '안',
    explanation: '"아니"의 뜻으로 홀로 쓸 때는 "안"이에요.',
    tag: '안/않',
  },
  {
    id: 'an-2',
    kind: 'mcq',
    level: 'basic',
    prompt: '숙제를 하지 ___았어요.',
    options: ['안', '않'],
    answer: '않',
    explanation: '"-지 않다" 꼴로 쓸 때는 "않"이에요. "안"은 "아니"를 줄인 말이라 뒤에 오는 말과 띄어 써요.',
    tag: '안/않',
  },

  /* ---------------- 이따가 / 있다가 ---------------- */
  {
    id: 'ittaga-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '___ 다시 만나자.',
    options: ['이따가', '있다가'],
    answer: '이따가',
    explanation: '조금 뒤에라는 뜻은 "이따가"예요.',
    tag: '이따가/있다가',
  },

  /* ---------------- 받침 ---------------- */
  {
    id: 'batchim-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '하늘이 참 ___.',
    options: ['맑다', '막다'],
    answer: '맑다',
    explanation: '"맑다"의 받침은 ㄹ과 ㄱ이 함께 있는 ㄺ이에요.',
    tag: '겹받침',
  },
  {
    id: 'batchim-2',
    kind: 'mcq',
    level: 'inter',
    prompt: '이 책은 ___이 얼마예요?',
    options: ['값', '갑'],
    answer: '값',
    explanation: '"값"의 받침은 ㅂ과 ㅅ이 함께 있는 ㅄ이에요.',
    tag: '겹받침',
  },
  {
    id: 'batchim-3',
    kind: 'mcq',
    level: 'basic',
    prompt: '어제 할머니 댁에 ___.',
    options: ['갔다', '같다'],
    answer: '갔다',
    explanation: '지나간 일은 "갔다"예요. "같다"는 서로 비슷할 때 써요.',
    tag: '받침',
  },

  /* ---------------- 개 / 게 (소리는 같지만 문맥으로 정해지는 낱말) ---------------- */
  {
    id: 'gaege-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '마당에서 ___를 키워요.',
    options: ['개', '게'],
    answer: '개',
    explanation: '강아지 같은 동물을 가리킬 때는 "개"예요.',
    tag: '개/게',
  },
  {
    id: 'gaege-2',
    kind: 'mcq',
    level: 'basic',
    prompt: '바닷가에서 ___를 잡았어요.',
    options: ['개', '게'],
    answer: '게',
    explanation: '집게발이 있는 바다 동물은 "게"예요.',
    tag: '개/게',
  },

  /* ---------------- 새 / 세 ---------------- */
  {
    id: 'saese-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '하늘을 나는 ___가 예뻐요.',
    options: ['새', '세'],
    answer: '새',
    explanation: '하늘을 나는 동물은 "새"예요.',
    tag: '새/세',
  },
  {
    id: 'saese-2',
    kind: 'mcq',
    level: 'basic',
    prompt: '사탕이 ___ 개 남았어요.',
    options: ['새', '세'],
    answer: '세',
    explanation: '숫자 3을 나타낼 때는 "세"예요("세 개").',
    tag: '새/세',
  },

  /* ---------------- 배 / 베 ---------------- */
  {
    id: 'baebe-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '___가 아파서 병원에 갔어요.',
    options: ['배', '베'],
    answer: '배',
    explanation: '몸의 일부를 가리킬 때는 "배"예요.',
    tag: '배/베',
  },
  {
    id: 'baebe-2',
    kind: 'mcq',
    level: 'basic',
    prompt: '칼에 손을 ___었어요.',
    options: ['배', '베'],
    answer: '베',
    explanation: '날카로운 것에 다치는 것은 "베다"예요.',
    tag: '배/베',
  },

  /* ---------------- 짓다 / 짖다 ---------------- */
  {
    id: 'jitda-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '엄마가 저녁밥을 ___.',
    options: ['지어요', '짖어요'],
    answer: '지어요',
    explanation: '"짓다"는 ㅅ불규칙이라 "지어요"로 활용해요.',
    tag: '짓다/짖다',
  },
  {
    id: 'jitda-2',
    kind: 'mcq',
    level: 'basic',
    prompt: '강아지가 멍멍 ___.',
    options: ['지어요', '짖어요'],
    answer: '짖어요',
    explanation: '동물이 소리를 내는 것은 "짖다"예요.',
    tag: '짓다/짖다',
  },

  /* ---------------- 표기가 헷갈리는 낱말 ---------------- */
  {
    id: 'guji-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '___ 그렇게까지 할 필요 없어요.',
    options: ['굳이', '구지'],
    answer: '굳이',
    explanation: '"구태여"라는 뜻일 때는 "굳이"로 써요.',
    tag: '표기',
  },
  {
    id: 'geumse-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '비가 ___ 그쳤어요.',
    options: ['금세', '금새'],
    answer: '금세',
    explanation: '"금시에"가 줄어든 말이라 "금세"로 써요.',
    tag: '표기',
  },
  {
    id: 'seolgeoji-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '저녁을 먹고 ___를 했어요.',
    options: ['설거지', '설겆이'],
    answer: '설거지',
    explanation: '"설거지"가 표준 표기예요.',
    tag: '표기',
  },
  {
    id: 'oraenman-1',
    kind: 'mcq',
    level: 'basic',
    prompt: '___이야, 잘 지냈니?',
    options: ['오랜만', '오랫만'],
    answer: '오랜만',
    explanation: '"오래간만"이 줄어든 말이라 "오랜만"으로 써요.',
    tag: '표기',
  },
  {
    id: 'tongteureo-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '우리 반 학생은 ___ 스무 명이에요.',
    options: ['통틀어', '통털어'],
    answer: '통틀어',
    explanation: '"통틀어"가 표준 표기예요.',
    tag: '표기',
  },
  {
    id: 'gomgomi-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '___ 생각해 보았어요.',
    options: ['곰곰이', '곰곰히'],
    answer: '곰곰이',
    explanation: '"곰곰" 뒤에 "-이"가 붙어 "곰곰이"가 돼요. "곰곰히"는 없는 말이에요.',
    tag: '표기',
  },
  {
    id: 'ililee-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '선생님이 ___ 확인해 주셨어요.',
    options: ['일일이', '일일히'],
    answer: '일일이',
    explanation: '"일일이"가 표준 표기예요.',
    tag: '표기',
  },

  /* ---------------- 반드시 / 반듯이 ---------------- */
  {
    id: 'bandeusi-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '약속은 ___ 지켜야 해요.',
    options: ['반드시', '반듯이'],
    answer: '반드시',
    explanation: '"꼭"이라는 뜻일 때는 "반드시"예요.',
    tag: '반드시/반듯이',
  },
  {
    id: 'bandeusi-2',
    kind: 'mcq',
    level: 'inter',
    prompt: '의자에 ___ 앉으세요.',
    options: ['반드시', '반듯이'],
    answer: '반듯이',
    explanation: '비뚤어지지 않게라는 뜻일 때는 "반듯이"예요.',
    tag: '반드시/반듯이',
  },

  /* ---------------- 든지 / 던지 ---------------- */
  {
    id: 'deunji-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '무엇을 먹___ 네 마음이야.',
    options: ['든지', '던지'],
    answer: '든지',
    explanation: '어느 것을 골라도 상관없다는 뜻일 때는 "든지"예요.',
    tag: '든지/던지',
  },
  {
    id: 'deunji-2',
    kind: 'mcq',
    level: 'advanced',
    prompt: '얼마나 춥___ 몰라요.',
    options: ['든지', '던지'],
    answer: '던지',
    explanation: '지난 일을 떠올리며 놀랄 때는 "던지"예요.',
    tag: '든지/던지',
  },

  /* ---------------- 활용이 헷갈리는 낱말 ---------------- */
  {
    id: 'damgeuda-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '김치를 ___.',
    options: ['담가요', '담궈요'],
    answer: '담가요',
    explanation: '"담그다"가 표준어예요. "담궈요"는 틀린 표기예요.',
    tag: '담그다/담구다',
  },
  {
    id: 'seollaeda-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '소풍 갈 생각에 마음이 ___.',
    options: ['설레요', '설레여요'],
    answer: '설레요',
    explanation: '"설레다"가 표준어예요. "설레이다"는 틀려요.',
    tag: '설레다',
  },
  {
    id: 'samgada-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '복도에서는 뛰는 것을 ___ 주세요.',
    options: ['삼가', '삼가해'],
    answer: '삼가',
    explanation: '"삼가다"가 표준어라 "삼가 주세요"로 써요.',
    tag: '삼가다',
  },
  {
    id: 'itda-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '실과 실을 ___.',
    options: ['이어요', '잇어요'],
    answer: '이어요',
    explanation: '"잇다"도 ㅅ불규칙이라 "이어요"로 활용해요.',
    tag: 'ㅅ불규칙',
  },

  /* ---------------- 로서 / 로써 ---------------- */
  {
    id: 'roseo-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '친구___ 도와줬어요.',
    options: ['로서', '로써'],
    answer: '로서',
    explanation: '"자격"을 나타낼 때는 "로서"예요.',
    tag: '로서/로써',
  },
  {
    id: 'roseo-2',
    kind: 'mcq',
    level: 'advanced',
    prompt: '대화___ 오해를 풀었어요.',
    options: ['로서', '로써'],
    answer: '로써',
    explanation: '"수단"을 나타낼 때는 "로써"예요.',
    tag: '로서/로써',
  },

  /* ---------------- 부치다 / 붙이다 ---------------- */
  {
    id: 'buchida-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '편지를 우체국에서 ___.',
    options: ['부쳤어요', '붙였어요'],
    answer: '부쳤어요',
    explanation: '편지나 소포를 보낼 때는 "부치다"예요.',
    tag: '부치다/붙이다',
  },
  {
    id: 'buchida-2',
    kind: 'mcq',
    level: 'advanced',
    prompt: '봉투에 우표를 ___.',
    options: ['부쳤어요', '붙였어요'],
    answer: '붙였어요',
    explanation: '무언가를 붙게 할 때는 "붙이다"예요.',
    tag: '부치다/붙이다',
  },

  /* ---------------- 다치다 / 닫히다 ---------------- */
  {
    id: 'dachida-1',
    kind: 'mcq',
    level: 'inter',
    prompt: '넘어져서 무릎을 ___.',
    options: ['다쳤어요', '닫혔어요'],
    answer: '다쳤어요',
    explanation: '몸을 다쳤을 때는 "다치다"예요.',
    tag: '다치다/닫히다',
  },
  {
    id: 'dachida-2',
    kind: 'mcq',
    level: 'inter',
    prompt: '바람에 문이 저절로 ___.',
    options: ['다쳤어요', '닫혔어요'],
    answer: '닫혔어요',
    explanation: '문이 저절로 닫힐 때는 "닫히다"예요.',
    tag: '다치다/닫히다',
  },

  /* ---------------- 늘리다 / 늘이다 ---------------- */
  {
    id: 'neullida-1',
    kind: 'mcq',
    level: 'advanced',
    prompt: '책 읽는 시간을 ___.',
    options: ['늘렸어요', '늘였어요'],
    answer: '늘렸어요',
    explanation: '시간이나 양을 많게 할 때는 "늘리다"예요.',
    tag: '늘리다/늘이다',
  },
  {
    id: 'neullida-2',
    kind: 'mcq',
    level: 'advanced',
    prompt: '고무줄을 힘껏 ___.',
    options: ['늘렸어요', '늘였어요'],
    answer: '늘였어요',
    explanation: '길이를 길게 잡아당길 때는 "늘이다"예요.',
    tag: '늘리다/늘이다',
  },

  /* ---------------- 빈칸 채우기 ---------------- */
  {
    id: 'fill-1',
    kind: 'fill',
    level: 'basic',
    prompt: '동생과 나는 키가 ___.',
    options: ['같아요', '갔아요', '갓아요'],
    answer: '같아요',
    explanation: '서로 비슷하다는 뜻은 "같다"예요.',
    tag: '받침',
  },
  {
    id: 'fill-2',
    kind: 'fill',
    level: 'inter',
    prompt: '꽃밭에 ___ 무엇을 보니?',
    options: ['안자서', '앉아서', '안따서'],
    answer: '앉아서',
    explanation: '"앉다"의 받침은 ㄴ과 ㅈ이 함께 있는 ㄵ이에요.',
    tag: '겹받침',
  },
  {
    id: 'fill-3',
    kind: 'fill',
    level: 'inter',
    prompt: '나뭇잎이 바람에 ___.',
    options: ['흔들려요', '흔들여요', '흔들레요'],
    answer: '흔들려요',
    explanation: '"흔들리다"에 "-어요"가 붙어 "흔들려요"가 돼요.',
    tag: '활용',
  },
  {
    id: 'fill-4',
    kind: 'fill',
    level: 'basic',
    prompt: '오늘은 날씨가 ___ 좋아요.',
    options: ['정말', '증말', '정멀'],
    answer: '정말',
    explanation: '"정말"이 바른 표기예요.',
    tag: '표기',
  },
  {
    id: 'fill-5',
    kind: 'fill',
    level: 'basic',
    prompt: '나는 우유를 ___ 빵을 먹었어요.',
    options: ['마시', '마셔', '마시고'],
    answer: '마시고',
    explanation: '뒤에 다른 일이 이어지므로 "마시고"가 알맞아요.',
    tag: '연결',
  },

  /* ---------------- 사이시옷 ---------------- */
  {
    id: 'ssiot-1',
    kind: 'fill',
    level: 'inter',
    prompt: '가을이 되니 ___이 떨어져요.',
    options: ['나무잎', '나뭇잎', '나뭇닢'],
    answer: '나뭇잎',
    explanation: '"나무"와 "잎" 사이에 사이시옷 ㅅ이 들어가 "나뭇잎"이 돼요.',
    tag: '사이시옷',
  },
  {
    id: 'ssiot-2',
    kind: 'fill',
    level: 'inter',
    prompt: '___에서 조개를 주웠어요.',
    options: ['바다가', '바닷가', '바다까'],
    answer: '바닷가',
    explanation: '"바다"와 "가" 사이에 사이시옷이 들어가 "바닷가"가 돼요.',
    tag: '사이시옷',
  },
  {
    id: 'ssiot-3',
    kind: 'fill',
    level: 'inter',
    prompt: '생일에 ___을 켰어요.',
    options: ['초불', '촛불', '촛뿔'],
    answer: '촛불',
    explanation: '"초"와 "불" 사이에 사이시옷이 들어가 "촛불"이 돼요.',
    tag: '사이시옷',
  },
  {
    id: 'ssiot-4',
    kind: 'fill',
    level: 'advanced',
    prompt: '___을 따라 학교에 갔어요.',
    options: ['등교길', '등굣길', '등교낄'],
    answer: '등굣길',
    explanation: '"등교"와 "길" 사이에 사이시옷이 들어가 "등굣길"이 돼요.',
    tag: '사이시옷',
  },
  {
    id: 'ssiot-5',
    kind: 'fill',
    level: 'advanced',
    prompt: '거울을 보며 ___을 살펴봤어요.',
    options: ['이몸', '잇몸', '이뽐'],
    answer: '잇몸',
    explanation: '"이"와 "몸" 사이에 사이시옷이 들어가 "잇몸"이 돼요.',
    tag: '사이시옷',
  },
  {
    id: 'ssiot-6',
    kind: 'fill',
    level: 'advanced',
    prompt: '___에 고기를 싸서 먹었어요.',
    options: ['깨잎', '깻잎', '깻닢'],
    answer: '깻잎',
    explanation: '"깨"와 "잎" 사이에 사이시옷이 들어가 "깻잎"이 돼요.',
    tag: '사이시옷',
  },

  /* ---------------- 틀린 곳 찾기 ---------------- */
  {
    id: 'find-1',
    kind: 'find',
    level: 'basic',
    prompt: '나는 학교에 가써요.',
    options: ['나는', '학교에', '가써요.'],
    answer: '가써요.',
    correction: '갔어요.',
    explanation: '"가다"에 지난 일을 나타내는 "-았-"이 붙어 "갔어요"가 돼요.',
    tag: '받침',
  },
  {
    id: 'find-2',
    kind: 'find',
    level: 'inter',
    prompt: '오늘은 하늘이 만아요.',
    options: ['오늘은', '하늘이', '만아요.'],
    answer: '만아요.',
    correction: '맑아요.',
    explanation: '"맑아요"가 바른 표기예요.',
    tag: '겹받침',
  },
  {
    id: 'find-3',
    kind: 'find',
    level: 'basic',
    prompt: '동생이 밥을 머거요.',
    options: ['동생이', '밥을', '머거요.'],
    answer: '머거요.',
    correction: '먹어요.',
    explanation: '소리 나는 대로 쓰지 않고 "먹어요"로 써요.',
    tag: '연음',
  },
  {
    id: 'find-4',
    kind: 'find',
    level: 'inter',
    prompt: '나는 책을 일거요.',
    options: ['나는', '책을', '일거요.'],
    answer: '일거요.',
    correction: '읽어요.',
    explanation: '"읽어요"로 써요. 받침 ㄺ을 살려서 적어요.',
    tag: '연음',
  },
  {
    id: 'find-5',
    kind: 'find',
    level: 'basic',
    prompt: '친구와 가치 놀았어요.',
    options: ['친구와', '가치', '놀았어요.'],
    answer: '가치',
    correction: '같이',
    explanation: '"같이"로 써요. 소리는 [가치]지만 적을 때는 "같이"예요.',
    tag: '구개음화',
  },
  {
    id: 'find-6',
    kind: 'find',
    level: 'basic',
    prompt: '꼬치 활짝 피었어요.',
    options: ['꼬치', '활짝', '피었어요.'],
    answer: '꼬치',
    correction: '꽃이',
    explanation: '"꽃이"로 써요. 소리는 [꼬치]지만 "꽃"의 받침을 살려요.',
    tag: '연음',
  },
  {
    id: 'find-7',
    kind: 'find',
    level: 'basic',
    prompt: '어머니께 편지를 썻어요.',
    options: ['어머니께', '편지를', '썻어요.'],
    answer: '썻어요.',
    correction: '썼어요.',
    explanation: '"썼어요"로 써요. 받침은 ㅆ이에요.',
    tag: '받침',
  },
  {
    id: 'find-8',
    kind: 'find',
    level: 'basic',
    prompt: '바람이 시원하게 부러요.',
    options: ['바람이', '시원하게', '부러요.'],
    answer: '부러요.',
    correction: '불어요.',
    explanation: '"불어요"로 써요. "불다"의 받침 ㄹ을 살려요.',
    tag: '연음',
  },
  {
    id: 'find-9',
    kind: 'find',
    level: 'basic',
    prompt: '나는 유치원에 다녓어요.',
    options: ['나는', '유치원에', '다녓어요.'],
    answer: '다녓어요.',
    correction: '다녔어요.',
    explanation: '"다녔어요"로 써요. "다니다"에 "-었어요"가 붙어 "녔"이 돼요.',
    tag: '활용',
  },
  {
    id: 'find-10',
    kind: 'find',
    level: 'basic',
    prompt: '친구가 나에게 인사를 해써요.',
    options: ['친구가', '나에게', '인사를', '해써요.'],
    answer: '해써요.',
    correction: '했어요.',
    explanation: '"했어요"로 써요.',
    tag: '받침',
  },
  {
    id: 'find-11',
    kind: 'find',
    level: 'inter',
    prompt: '아빠가 신문을 일그세요.',
    options: ['아빠가', '신문을', '일그세요.'],
    answer: '일그세요.',
    correction: '읽으세요.',
    explanation: '"읽으세요"로 써요. 받침 ㄺ을 살려요.',
    tag: '연음',
  },
  {
    id: 'find-12',
    kind: 'find',
    level: 'basic',
    prompt: '우리는 손을 마조 잡았어요.',
    options: ['우리는', '손을', '마조', '잡았어요.'],
    answer: '마조',
    correction: '마주',
    explanation: '"마주"로 써요.',
    tag: '표기',
  },
  {
    id: 'find-13',
    kind: 'find',
    level: 'inter',
    prompt: '하늘이 오늘따라 유난이 파래요.',
    options: ['하늘이', '오늘따라', '유난이', '파래요.'],
    answer: '유난이',
    correction: '유난히',
    explanation: '"유난히"로 써요. "유난하다"에서 온 말이라 "-히"를 붙여요.',
    tag: '표기',
  },
  {
    id: 'find-14',
    kind: 'find',
    level: 'basic',
    prompt: '동생이 나보다 키가 조끔 커요.',
    options: ['동생이', '나보다', '키가', '조끔', '커요.'],
    answer: '조끔',
    correction: '조금',
    explanation: '"조금"으로 써요.',
    tag: '표기',
  },
  {
    id: 'find-15',
    kind: 'find',
    level: 'basic',
    prompt: '친구들과 함께 숨박꼭질을 했어요.',
    options: ['친구들과', '함께', '숨박꼭질을', '했어요.'],
    answer: '숨박꼭질을',
    correction: '숨바꼭질을',
    explanation: '"숨바꼭질"이 표준 표기예요.',
    tag: '표기',
  },
  {
    id: 'find-16',
    kind: 'find',
    level: 'advanced',
    prompt: '바다가에서 조개껍데기를 주웠다.',
    options: ['바다가에서', '조개껍데기를', '주웠다.'],
    answer: '바다가에서',
    correction: '바닷가에서',
    explanation: '"바닷가에서"로 써야 해요. 사이시옷이 빠졌어요.',
    tag: '사이시옷',
  },
  {
    id: 'find-17',
    kind: 'find',
    level: 'advanced',
    prompt: '그 아이는 반듯이 숙제를 끝냈다.',
    options: ['그', '아이는', '반듯이', '숙제를', '끝냈다.'],
    answer: '반듯이',
    correction: '반드시',
    explanation: '"꼭"이라는 뜻이면 "반드시"로 써야 해요.',
    tag: '반드시/반듯이',
  },
  {
    id: 'find-18',
    kind: 'find',
    level: 'advanced',
    prompt: '노력하면 무엇이던지 해낼 수 있어요.',
    options: ['노력하면', '무엇이던지', '해낼', '수', '있어요.'],
    answer: '무엇이던지',
    correction: '무엇이든지',
    explanation: '선택의 뜻이면 "무엇이든지"로 써야 해요.',
    tag: '든지/던지',
  },
];

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 유형별로 문제를 골라 섞습니다. 난이도는 보지 않습니다. */
export function pickQuestions(kind: SpellingKind, count = 10): SpellingQuestion[] {
  const pool = SPELLING_BANK.filter((q) => q.kind === kind);
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

/**
 * 난이도를 섞어서 고릅니다. 세션에서 이걸 씁니다.
 *
 * 문항이 47개로 늘면서 로서/로써·늘리다/늘이다 같은 고급 항목이 섞였습니다.
 * 완전 무작위로 뽑으면 저학년 아이가 첫 시험에서 어려운 문항을 몰아 받을 수 있고,
 * 시험 모드는 90점을 넘어야 배지를 받으니 실력과 무관하게 배지를 놓치게 됩니다.
 * 그래서 기본·중급을 많이, 고급은 조금만 섞습니다.
 */
const LEVEL_WEIGHT: Record<SpellingLevel, number> = { basic: 0.4, inter: 0.4, advanced: 0.2 };

export function pickBalanced(kind: SpellingKind, count = 10): SpellingQuestion[] {
  const pool = SPELLING_BANK.filter((q) => q.kind === kind);
  const picked: SpellingQuestion[] = [];

  for (const level of ['basic', 'inter', 'advanced'] as const) {
    const want = Math.round(count * LEVEL_WEIGHT[level]);
    const fromLevel = shuffle(pool.filter((q) => q.level === level));
    picked.push(...fromLevel.slice(0, want));
  }

  // 어느 난이도가 문항 수가 적으면 목표를 못 채울 수 있습니다.
  // 그 자리는 아직 안 고른 문항으로 채워 개수를 맞춥니다.
  if (picked.length < count) {
    const used = new Set(picked.map((q) => q.id));
    const rest = shuffle(pool.filter((q) => !used.has(q.id)));
    picked.push(...rest.slice(0, count - picked.length));
  }

  return shuffle(picked).slice(0, Math.min(count, picked.length));
}
