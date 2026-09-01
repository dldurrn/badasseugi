import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 앱 코드가 쓰는 `@/` 경로를 테스트에서도 같게 맞춥니다 (tsconfig의 paths와 짝).
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    /*
      **Vercel 은 UTC 로 돕니다.** 테스트도 거기 맞춥니다.

      이 PC 는 서울이라, 시간대에 기대는 버그가 여기서는 멀쩡히 통과하고
      배포한 뒤에야 드러납니다. 실제로 그랬습니다 —
      한국 시간 자정~아침 9시에 받은 메달이 전날로 찍혔고,
      TTS 하루 한도가 자정이 아니라 아침 9시에 리셋됐습니다.
    */
    env: { TZ: 'UTC' },
    include: ['src/**/*.test.ts'],
  },
});
