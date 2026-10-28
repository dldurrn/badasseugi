import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_GAP_MS, DEMO_SENTENCES, demoAudioPath } from './demo';
import { demoAudioFor } from './demo-speech';
import { grade } from './grading';
import { GAP_BETWEEN_WORDS } from './tts';
import { toCells } from './wongoji';
import { DICTATION_BANK } from '@/data/dictation-bank';

describe('로그인 전 체험', () => {
  it('문장마다 소리 파일 두 벌이 다 있습니다 — 문장을 바꾸고 다시 안 만들면 여기서 걸립니다', () => {
    for (const { id } of DEMO_SENTENCES) {
      for (const kind of ['flow', 'chunked'] as const) {
        expect(existsSync(join(process.cwd(), 'public', demoAudioPath(id, kind))), `${id}-${kind}`).toBe(true);
      }
    }
  });

  it('또박또박 쉼이 앱과 같습니다', () => {
    expect(DEMO_GAP_MS).toBe(GAP_BETWEEN_WORDS);
  });

  it('원고지 한 줄에 들어가고, 내장 문제은행 문장입니다', () => {
    const bank = new Set(DICTATION_BANK.flatMap((s) => s.sentences));
    for (const { sentence } of DEMO_SENTENCES) {
      expect(toCells(sentence).length).toBeLessThanOrEqual(15);
      expect(bank.has(sentence), sentence).toBe(true);
    }
  });

  it('id 가 겹치지 않고 주소에 쓸 수 있는 글자뿐입니다', () => {
    const ids = DEMO_SENTENCES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('컨트롤러가 다듬어 넘긴 문장으로도 파일을 찾고, 다른 문장은 못 찾습니다', () => {
    expect(demoAudioFor(` ${DEMO_SENTENCES[0].sentence}  `, 'flow')).toBe(
      demoAudioPath(DEMO_SENTENCES[0].id, 'flow'),
    );
    expect(demoAudioFor('학교에 갔어요.', 'flow')).toBeNull();
  });

  it('「아이들은 이렇게 틀려요」 예시는 문장마다 따로 있고, 띄어쓰기를 포함해 둘 이상을 짚습니다', () => {
    for (const d of DEMO_SENTENCES) {
      const result = grade(d.sentence, d.childWrites);
      expect(result.correct, d.id).toBe(false);
      expect(result.errorTypes, d.id).toContain('spacing');
      expect(result.errorTypes.length, d.id).toBeGreaterThanOrEqual(2);
    }
    // 첫 문장은 문 여는 자리라 세 갈래를 한 번에 보여 줍니다
    expect(grade(DEMO_SENTENCES[0].sentence, DEMO_SENTENCES[0].childWrites).errorTypes).toEqual(
      expect.arrayContaining(['vowel', 'spacing', 'batchim']),
    );
  });
});
