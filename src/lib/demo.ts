/**
 * 로그인 전 체험(`/try`)에 쓰는 문장과 미리 만든 소리 파일.
 *
 * **이 파일은 아무것도 불러오지 않습니다.** 소리를 만드는 스크립트
 * (`scripts/make-demo-audio.mjs`)가 Node 로 곧장 읽어야 해서입니다 — `@/` 경로를 쓰면 거기서 깨집니다.
 *
 * 소리를 서버에서 그때그때 만들지 않는 이유: `/api/tts` 는 로그인한 집의 하루 한도로 셉니다.
 * 로그인 안 한 사람에게 열면 한도·차단 장치를 새로 만들어야 하고, 방문자마다 타입캐스트를 씁니다.
 * 문장이 셋뿐이라 한 번 만들어 두면 0원이고, 누르자마자 납니다.
 *
 * **문장을 바꾸면 소리를 다시 만드세요**(`node scripts/make-demo-audio.mjs`).
 * 테스트가 파일이 다 있는지 지킵니다. 없으면 화면은 조용히 브라우저 음성으로 읽습니다.
 */

export interface DemoSentence {
  /** 파일 이름. 영문만 — 주소에 한글을 넣으면 깨져 오는 브라우저가 있습니다 */
  id: string;
  sentence: string;
}

/*
  내장 문제은행(14단계·12단계 근처)에서 골랐습니다. 1학년이 실제로 많이 틀리는 자리가 하나씩 들었습니다.
    ① ㅆ 받침(갔), 소리 나는 대로 쓰기(병원에 → 병워네)
    ② 이어지는 소리(밥을 → 바블), ㅆ 받침
    ③ 붙여 쓰는 낱말(뛰어갔어요)
  첫 문장이 문 여는 자리라 가장 짧고 흔한 것을 앞에 둡니다.
*/
export const DEMO_SENTENCES: readonly DemoSentence[] = [
  { id: 'hospital', sentence: '아파서 병원에 갔어요.' },
  { id: 'hungry', sentence: '배가 고파서 밥을 먹었어요.' },
  { id: 'late', sentence: '늦어서 뛰어갔어요.' },
];

/**
 * 「아이들은 이렇게 많이 틀려요」에 보여 줄 오답.
 *
 * **체험하는 사람은 대개 부모이고, 어른은 거의 다 맞게 씁니다.**
 * 그러면 100점만 뜨고 이 앱의 진짜 쓸모 — 틀린 곳을 한 글자씩 짚는 채점표 — 를 못 봅니다.
 * 그래서 실제 채점 엔진에 넣어 돌린 결과를 하나 더 보여 줍니다(그림이 아니라 계산).
 * 모음(ㅔ→ㅐ)·띄어쓰기·받침(ㅆ→ㅅ) 세 가지가 한 문장에 다 걸리게 골랐습니다.
 */
export const DEMO_MISTAKE = {
  answer: '아파서 병원에 갔어요.',
  written: '아파서 병원애갓어요.',
} as const;

/** 소리 파일이 놓이는 자리(`public/` 아래) */
export const DEMO_AUDIO_DIR = '/demo-audio';

/**
 * 또박또박 듣기의 어절 사이 쉼. `tts.ts` 의 `GAP_BETWEEN_WORDS` 와 같아야 합니다 —
 * 테스트가 둘을 맞춰 봅니다. 여기 다시 적는 것은 위의 「아무것도 안 불러온다」 때문입니다.
 */
export const DEMO_GAP_MS = 520;

export type DemoAudioKind = 'flow' | 'chunked';

export function demoAudioPath(id: string, kind: DemoAudioKind): string {
  return `${DEMO_AUDIO_DIR}/${id}-${kind}.mp3`;
}
