import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import { makeTwin } from './twin-ai';
import { toCells } from './wongoji';

/** 실제 Anthropic 을 부르는 확인용. 평소 테스트에는 안 들어갑니다(.check.ts). */
beforeAll(() => {
  const env = fs.readFileSync('.env.local', 'utf8');
  const m = env.match(/^ANTHROPIC_API_KEY=(.+)$/m);
  if (m) process.env.ANTHROPIC_API_KEY = m[1].trim();
});

describe('실제로 만들어 본다', () => {
  const 사례 = [
    { origin: '포도', wrongInput: '보도', errorTypes: ['consonant'] as const },
    { origin: '닭이 울어요', wrongInput: '닥이 울어요', errorTypes: ['batchim'] as const },
    { origin: '학교에 갑니다', wrongInput: '학교에갑니다', errorTypes: ['spacing'] as const },
    { origin: '꽃이 피었어요', wrongInput: '꼿이 피었어요', errorTypes: ['consonant'] as const },
  ];

  for (const c of 사례) {
    it(`${c.origin} (${c.errorTypes[0]})`, { timeout: 30000 }, async () => {
      const twin = await makeTwin({ ...c, errorTypes: [...c.errorTypes], used: [] });
      const 원본칸 = toCells(c.origin).length;
      const 짝칸 = twin ? toCells(twin).length : 0;
      console.log(`  ${c.origin}(${원본칸}칸) → ${twin ?? '(못 만듦)'}${twin ? `(${짝칸}칸)` : ''}`);
      if (twin) {
        expect(짝칸).toBeLessThanOrEqual(15);
        expect(twin).not.toBe(c.origin);
      }
    });
  }
});
