import { NextResponse } from 'next/server';

/**
 * 화면에서 깨진 것을 서버 기록으로 옮깁니다.
 *
 * 지금까지는 **남의 집에서 화면이 깨져도 아무도 몰랐습니다.**
 * 브라우저 콘솔에만 남고 그 콘솔은 아무도 안 봅니다.
 * 부모는 「앱이 이상해요」라고 말할 수는 있어도 무엇이 어떻게 깨졌는지는 옮길 수 없습니다.
 *
 * 여기로 보내면 Vercel 로그에 남습니다. 완전한 추적 도구는 아니지만
 * **계정도 결제도 없이 오늘 바로 되는 것**이고, 없는 것보다 훨씬 낫습니다.
 * (나중에 Sentry 같은 것을 붙이면 여기만 갈아 끼우면 됩니다.)
 *
 * 로그인 확인을 하지 않습니다 — **로그인 화면에서 깨진 것도 알아야** 하니까요.
 * 대신 아무나 로그를 채울 수 있으므로 크기를 바짝 자르고, 몸통도 남기지 않습니다.
 *
 * 개인정보는 담지 않습니다. 보내는 쪽(error.tsx)이 오류 글과 주소만 싣습니다.
 */

/** 길이를 자릅니다. 로그가 길면 읽히지 않고, 길게 보낼 이유도 없습니다. */
function 자르기(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

interface Body {
  message?: unknown;
  /** Next가 붙이는 오류 식별자. 서버 오류면 이걸로 짝을 맞출 수 있습니다 */
  digest?: unknown;
  path?: unknown;
  stack?: unknown;
}

export async function POST(request: Request) {
  let body: Body | null = null;
  try {
    body = (await request.json()) as Body;
  } catch {
    // 읽지 못해도 조용히 넘어갑니다. 기록을 남기려다 또 깨지면 안 됩니다.
    return NextResponse.json({ ok: true });
  }

  console.error('[화면 오류]', {
    message: 자르기(body?.message, 300),
    digest: 자르기(body?.digest, 60),
    path: 자르기(body?.path, 200),
    stack: 자르기(body?.stack, 1200),
    at: new Date().toISOString(),
  });

  // 화면은 이 응답을 기다리지 않습니다. 언제나 성공으로 답합니다.
  return NextResponse.json({ ok: true });
}
