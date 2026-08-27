import Link from 'next/link';

export const metadata = { title: '가입 완료 · 받아쓰기 공책' };

/**
 * 가입 확인이 끝났다는 것만 알리는 자리.
 *
 * 메일 링크를 누르면 Supabase가 그 자리에서 이메일을 확인해 주고 여기로 보냅니다.
 * 예전에는 여기서 로그인 세션까지 만들어 앱으로 들여보냈는데, 두 가지가 걸렸습니다.
 *
 * 하나 — 메일은 대개 **다른 기기**에서 엽니다. PC에서 가입하고 폰에서 메일을 열죠.
 * 세션을 만들려면 가입할 때 그 브라우저에 넣어 둔 열쇠가 필요한데 폰에는 없습니다.
 * 그러면 확인은 됐는데도 "로그인을 끝내지 못했어요" 같은 화면을 보게 됩니다.
 *
 * 둘 — 메일을 연 기기에서 로그인이 되어 버리면, 정작 쓰려던 기기와 다를 수 있습니다.
 *
 * 그래서 여기서는 **아무것도 하지 않습니다.** 주소에 딸려 온 코드도 쓰지 않습니다.
 * 확인은 이미 끝났고, 로그인은 원래 쓰던 기기에서 하면 됩니다.
 */
export default function ConfirmedPage() {
  return (
    <main className="page" style={{ paddingBottom: 40 }}>
      <header className="pb-8 pt-16 text-center">
        {/*
          금색이 아니라 초록입니다.

          금색은 보상 전용입니다(절대 원칙 · 디자인). 앱을 열 때마다 처음 보는 색이
          금색이면, 100점을 받았을 때의 금색이 특별할 까닭이 없어집니다.
          여기 필요한 것은 「상」이 아니라 「제목 위의 표시」라 구조색인 초록이 맞습니다.
        */}
        <div
          className="mx-auto mb-4 h-1 w-12 rounded-full"
          style={{ background: 'var(--grid)' }}
        />
        <h1 className="display text-[30px] font-bold" style={{ color: 'var(--grid-deep)' }}>
          가입이 끝났어요
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          이제 받아쓰기 공책을 쓰실 수 있어요
        </p>
      </header>

      <section
        className="rounded p-5 text-center"
        style={{ background: 'var(--card)', border: '2px solid var(--grid)' }}
      >
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          이메일 확인이 끝났습니다.
          <br />
          가입할 때 쓰던 기기에서 로그인해 주세요.
        </p>
        <Link href="/login" className="btn btn-primary btn-lg mt-4">
          로그인하러 가기
        </Link>
      </section>

      <p
        className="mt-8 text-center text-[11.5px] leading-relaxed"
        style={{ color: 'var(--ink-faint)' }}
      >
        이 창은 닫으셔도 됩니다.
        <br />
        아이의 이름 대신 별명만 사용해요.
        <br />
        <Link href="/privacy" style={{ textDecoration: 'underline' }}>
          개인정보처리방침
        </Link>
      </p>
    </main>
  );
}
