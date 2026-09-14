import { describe, expect, it } from 'vitest';
import { engineLine } from '@/lib/tts-status';

/*
  이 파일이 지키는 것은 문구의 예쁨이 아니라 **거짓말을 안 하는가**입니다.

  실제로 있었던 일: 타입캐스트가 403 으로 막혀 Google 이 읽던 며칠 동안
  설정 화면은 「지금 Typecast 로 읽고 있어요」라고 말하고 있었습니다.
  회사끼리의 폴백은 소리가 정상적으로 나서 어디에도 안 잡혔기 때문입니다.
*/

describe('engineLine — 부모에게 무엇을 말하나', () => {
  describe('아직 한 번도 안 들었을 때', () => {
    it('「읽고 있어요」라고 하지 않는다 — 합성을 해 본 적이 없다', () => {
      const line = engineLine('typecast', null, 'typecast');
      expect(line.text).not.toContain('읽고 있어요');
      expect(line.text).not.toContain('읽었어요');
    });

    it('예정이라는 것이 드러난다', () => {
      expect(engineLine('typecast', null, 'typecast').text).toBe('Typecast를 먼저 시도해요');
      expect(engineLine('google', null, 'auto').text).toBe('Google를 먼저 시도해요');
    });

    it('아직 아무 일도 안 일어났으므로 경고가 아니다', () => {
      expect(engineLine('typecast', null, 'typecast').warn).toBe(false);
    });
  });

  describe('고른 회사가 읽었을 때', () => {
    it('실제로 읽은 회사를 과거형으로 말한다', () => {
      expect(engineLine('typecast', 'typecast', 'typecast').text).toBe('방금 Typecast로 읽었어요');
    });

    it('경고가 아니다', () => {
      expect(engineLine('typecast', 'typecast', 'typecast').warn).toBe(false);
    });
  });

  describe('고른 회사가 막혀 다른 회사가 읽었을 때 ← 이 파일이 생긴 이유', () => {
    const line = engineLine('google', 'google', 'typecast');

    it('막혔다는 사실과 대신 읽은 회사를 둘 다 말한다', () => {
      expect(line.text).toContain('Typecast');
      expect(line.text).toContain('막혀');
      expect(line.text).toContain('Google');
    });

    it('부모가 손을 써야 하므로 경고로 표시한다', () => {
      expect(line.warn).toBe(true);
    });

    it('고른 회사로 읽고 있다고 말하지 않는다', () => {
      expect(line.text).not.toBe('방금 Typecast로 읽었어요');
    });
  });

  describe('회사를 막 바꿔 들어 보는 중일 때', () => {
    /*
      Google → Typecast 로 누른 직후에는 기록이 아직 Google 입니다.
      그 틈에 견주면 멀쩡한 Typecast 가 막혔다고 나옵니다 — 실제로 그렇게 보고됐습니다.
    */
    it('예전 기록이 남아 있어도 막혔다고 하지 않는다', () => {
      const line = engineLine('typecast', 'google', 'typecast', true);
      expect(line.warn).toBe(false);
      expect(line.text).not.toContain('막혀');
      expect(line.text).toBe('들어 보는 중…');
    });

    it('어느 회사가 읽었다고도 말하지 않는다 — 아직 모른다', () => {
      const line = engineLine('typecast', 'typecast', 'typecast', true);
      expect(line.text).not.toContain('읽었어요');
    });

    it('다 듣고 나면 원래대로 판정한다', () => {
      expect(engineLine('google', 'google', 'typecast', false).warn).toBe(true);
    });
  });

  describe('자동으로 두었을 때', () => {
    /*
      「알아서 골라 달라」고 한 것이라 어느 쪽이 읽어도 어긋난 것이 아닙니다.
      그래도 무엇이 읽었는지는 말해 줍니다 — 소리를 듣고 「이게 어느 쪽이지」 할 때
      답을 찾을 곳이 이 줄뿐입니다.
    */
    it('예정과 다른 회사가 읽어도 경고하지 않는다', () => {
      const line = engineLine('typecast', 'google', 'auto');
      expect(line.warn).toBe(false);
      expect(line.text).toBe('방금 Google로 읽었어요');
    });
  });

  describe('모르는 회사 이름', () => {
    it('이름을 지어내지 않고 받은 그대로 보여 준다', () => {
      expect(engineLine('clova', 'clova', 'auto').text).toBe('방금 clova로 읽었어요');
    });
  });

  /*
    「서버가 1순위로 고른 회사」는 합성을 해 보지 않은 값이라,
    실제로 읽은 기록이 있으면 그쪽이 언제나 이깁니다.
  */
  it('실제 기록이 있으면 서버의 예정값은 문구에 안 들어간다', () => {
    const line = engineLine('typecast', 'google', 'auto');
    expect(line.text).not.toContain('Typecast');
  });
});
