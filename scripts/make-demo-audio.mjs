/**
 * 로그인 전 체험(`/try`)의 소리 파일을 만듭니다.
 *
 *   node scripts/make-demo-audio.mjs
 *
 * 문장은 `src/lib/demo.ts` 한 곳에서 읽습니다. 문장을 바꿨으면 이걸 다시 돌리고
 * `public/demo-audio/` 를 커밋하세요. 앱이 쓰는 것과 **같은 합성 코드**(`tts-engines.ts`)를
 * 그대로 불러 쓰므로, 아이가 앱에서 듣는 소리와 체험에서 듣는 소리가 같습니다.
 *
 * Node 24 가 .ts 를 그대로 읽습니다(타입만 걷어 냄). 그래서 두 파일은 아무것도 불러오지 않게 둡니다.
 * 키는 `.env.local` 에서 읽습니다 — 화면으로는 절대 안 나갑니다(절대 원칙 8).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(join(root, '.env.local'));

const { pickEngines } = await import('../src/lib/tts-engines.ts');
const { DEMO_SENTENCES, DEMO_GAP_MS, demoAudioPath } = await import('../src/lib/demo.ts');

const engine = pickEngines('auto')[0];
if (!engine) {
  console.error('음성 키가 없습니다. .env.local 에 TYPECAST_API_KEY 나 GOOGLE_TTS_API_KEY 를 넣어 주세요.');
  process.exit(1);
}
console.log(`${engine.name} · ${engine.defaultVoice} 로 만듭니다`);

for (const { id, sentence } of DEMO_SENTENCES) {
  for (const [kind, gapMs] of [
    ['flow', 0],
    ['chunked', DEMO_GAP_MS],
  ]) {
    const result = await engine.synthesize({ text: sentence, rate: 1, voice: engine.defaultVoice, gapMs });
    const out = join(root, 'public', demoAudioPath(id, kind));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(result.audio));
    console.log(`  ${demoAudioPath(id, kind)}  ${(result.audio.byteLength / 1024).toFixed(0)}KB  「${sentence}」`);
  }
}
