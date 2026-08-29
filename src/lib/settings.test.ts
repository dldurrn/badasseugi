import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  cleanPatch,
  cleanRate,
  cleanVoice,
  cleanWriteMode,
  fromRow,
  resolveSettings,
  toColumns,
  cleanEngine,
} from './settings';

/**
 * 여기서 지킬 것 —
 * **아이가 고른 것이 부모 기본값을 덮되, 안 고른 것은 부모를 따라간다.**
 *
 * 이게 어긋나면 두 가지가 납니다.
 *   - 형이 고른 목소리가 동생에게도 나오거나,
 *   - 부모가 기본값을 바꿨는데 아이에게 안 닿거나.
 */

describe('resolveSettings — 아이 → 부모 → 앱 기본값 순서로 내려간다', () => {
  it('아무도 안 골랐으면 앱 기본값', () => {
    expect(resolveSettings(null, null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({}, {})).toEqual(DEFAULT_SETTINGS);
  });

  it('부모만 정했으면 부모 것', () => {
    const r = resolveSettings({ rate: 0.65, writeMode: 'plain', voice: 'tc_a' }, {});
    expect(r).toEqual({ rate: 0.65, writeMode: 'plain', voice: 'tc_a' });
  });

  it('아이가 골랐으면 아이 것이 이긴다', () => {
    const r = resolveSettings(
      { rate: 0.65, writeMode: 'plain', voice: 'tc_a' },
      { rate: 1.0, writeMode: 'wongoji', voice: 'tc_b' },
    );
    expect(r).toEqual({ rate: 1.0, writeMode: 'wongoji', voice: 'tc_b' });
  });

  it('**항목마다 따로 내려간다** — 목소리만 고른 아이는 속도가 부모 것', () => {
    const r = resolveSettings({ rate: 0.65, writeMode: 'plain' }, { voice: 'tc_b' });
    expect(r).toEqual({ rate: 0.65, writeMode: 'plain', voice: 'tc_b' });
  });

  it('아이 값을 비우면 다시 부모를 따라간다', () => {
    // 「안 고름」으로 되돌리는 길입니다. 이게 없으면 한 번 고른 아이는 영영 못 돌아옵니다.
    const r = resolveSettings({ rate: 0.65 }, { rate: null });
    expect(r.rate).toBe(0.65);
  });

  it('알아볼 수 없는 값이 저장돼 있어도 조용히 내려간다', () => {
    // DB에 제약을 걸어 뒀지만 옛 값이 남아 있을 수 있습니다.
    // 아이 화면이 깨지는 것보다 기본값이 낫습니다.
    const r = resolveSettings({ rate: 99, writeMode: '세로쓰기' }, { rate: -1 });
    expect(r.rate).toBe(DEFAULT_SETTINGS.rate);
    expect(r.writeMode).toBe(DEFAULT_SETTINGS.writeMode);
  });
});

describe('값 다듬기', () => {
  it('속도는 화면이 고를 수 있는 셋만 받는다', () => {
    expect(cleanRate(0.65)).toBe(0.65);
    expect(cleanRate(0.85)).toBe(0.85);
    expect(cleanRate(1.0)).toBe(1.0);
    // 사이값·범위 밖·글자는 안 고른 것으로 봅니다
    expect(cleanRate(0.9)).toBeNull();
    expect(cleanRate(3)).toBeNull();
    expect(cleanRate('빠르게')).toBeNull();
    expect(cleanRate(null)).toBeNull();
  });

  it('쓰기 방법은 둘 뿐', () => {
    expect(cleanWriteMode('wongoji')).toBe('wongoji');
    expect(cleanWriteMode('plain')).toBe('plain');
    expect(cleanWriteMode('grid')).toBeNull();
  });

  it('목소리는 모양만 본다 — 회사별 형태는 소리 만들 때 가립니다', () => {
    expect(cleanVoice('ko-KR-Chirp3-HD-Gacrux')).toBe('ko-KR-Chirp3-HD-Gacrux');
    expect(cleanVoice('tc_60915b5616d74069af8e8cab')).toBe('tc_60915b5616d74069af8e8cab');
    expect(cleanVoice('  여백 붙은 것  ')).toBe('여백 붙은 것');
    expect(cleanVoice('')).toBeNull();
    expect(cleanVoice('가'.repeat(200))).toBeNull();
    expect(cleanVoice(42)).toBeNull();
  });
});

describe('cleanPatch — 보내지 않은 항목은 건드리지 않는다', () => {
  it('보낸 것만 남는다', () => {
    expect(cleanPatch({ rate: 0.65 })).toEqual({ rate: 0.65 });
    expect(cleanPatch({ voice: 'tc_a' })).toEqual({ voice: 'tc_a' });
  });

  it('null 을 보내면 「안 고름」으로 되돌린다', () => {
    // 키가 있으면 값이 null이어도 남아야 합니다. 그래야 부모 기본값으로 돌아갑니다.
    const p = cleanPatch({ rate: null });
    expect('rate' in p).toBe(true);
    expect(p.rate).toBeNull();
  });

  it('아무것도 안 보내면 비어 있다 — 라우트가 이걸 보고 막습니다', () => {
    expect(cleanPatch({})).toEqual({});
    expect(cleanPatch(null)).toEqual({});
  });

  it('알아볼 수 없는 값은 null 로 — 엉뚱한 값이 저장되지 않게', () => {
    expect(cleanPatch({ rate: 3 }).rate).toBeNull();
    expect(cleanPatch({ writeMode: '세로' }).writeMode).toBeNull();
  });
});

describe('DB 칸 이름 — 층마다 다릅니다', () => {
  it('부모 층은 default_ 가 붙는다', () => {
    expect(toColumns({ rate: 0.65, voice: 'tc_a' }, 'family')).toEqual({
      default_rate: 0.65,
      default_voice: 'tc_a',
    });
  });

  it('아이 층은 안 붙는다', () => {
    expect(toColumns({ writeMode: 'plain' }, 'child')).toEqual({ write_mode: 'plain' });
  });

  it('안 보낸 항목은 칸에도 안 들어간다 — update 가 딴 값을 지우면 안 됩니다', () => {
    const row = toColumns({ rate: 1.0 }, 'child');
    expect(Object.keys(row)).toEqual(['rate']);
  });

  it('fromRow 가 다시 읽어 온다', () => {
    expect(
      fromRow({ default_rate: 0.85, default_write_mode: 'plain', default_voice: null }, 'family'),
    ).toEqual({ rate: 0.85, writeMode: 'plain', voice: null, engine: null });
    expect(fromRow({ rate: 1, write_mode: 'wongoji', voice: 'tc_a' }, 'child')).toEqual({
      rate: 1,
      writeMode: 'wongoji',
      voice: 'tc_a',
      // 회사 고르기는 집 단위라 아이 층에는 아예 없습니다.
      engine: null,
    });
  });

  it('칸이 아직 없으면(마이그레이션 전) 전부 안 고른 것으로 본다', () => {
    expect(fromRow({}, 'child')).toEqual({
      rate: null,
      writeMode: null,
      voice: null,
      engine: null,
    });
    expect(fromRow(null, 'family')).toEqual({});
  });
});

describe('목소리 회사 고르기', () => {
  it('아는 이름만 받는다', () => {
    expect(cleanEngine('auto')).toBe('auto');
    expect(cleanEngine('typecast')).toBe('typecast');
    expect(cleanEngine('google')).toBe('google');
  });

  it('모르는 값은 안 고른 것으로 본다', () => {
    // 예전에 쓰던 회사 이름이 남아 있어도 조용히 자동으로 돌아가야 합니다.
    for (const bad of ['clova', 'openai', '', null, undefined, 1, {}]) {
      expect(cleanEngine(bad), String(bad)).toBeNull();
    }
  });

  it('집 단위라 부모 층에만 저장한다', () => {
    expect(toColumns({ engine: 'google' }, 'family')).toEqual({ default_engine: 'google' });
  });

  it('아이 층으로 보내면 조용히 버린다', () => {
    /*
      children 에는 이 칸이 없습니다. 그대로 보내면 저장 전체가 실패해서,
      목소리를 바꾸려던 아이가 아무것도 못 바꾸게 됩니다.
    */
    expect(toColumns({ engine: 'google', voice: 'tc_a' }, 'child')).toEqual({ voice: 'tc_a' });
  });

  it('화면이 보낸 것 중 아는 것만 남긴다', () => {
    expect(cleanPatch({ engine: 'typecast' })).toEqual({ engine: 'typecast' });
    expect(cleanPatch({ engine: 'clova' })).toEqual({ engine: null });
    // 안 보낸 항목은 건드리지 않습니다.
    expect(cleanPatch({ rate: 1 })).toEqual({ rate: 1 });
  });

  it('부모 행에서 읽어 온다', () => {
    expect(fromRow({ default_engine: 'google' }, 'family').engine).toBe('google');
    // 마이그레이션 전이라 칸이 없으면 안 고른 것입니다.
    expect(fromRow({ default_rate: 1 }, 'family').engine).toBeNull();
  });
});
