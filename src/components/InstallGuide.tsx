'use client';

import { useEffect, useState } from 'react';
import {
  INSTALL_DISMISSED_KEY,
  RECIPES,
  type Surface,
  detectSurface,
  inappName,
  looksLikeIpad,
} from '@/lib/install';

/**
 * 홈 화면에 두는 법을 기기에 맞춰 알려 줍니다.
 *
 * 갈래마다 할 말이 다른 이유는 `lib/install.ts` 머리말에 적어 두었습니다.
 * 요지는 **브라우저가 알아서 권해 주지 않는다**는 것입니다.
 */

/*
  안드로이드 Chrome 이 「설치하시겠어요」를 우리에게 넘겨줄 때가 있습니다.
  받아 두면 버튼 하나로 끝낼 수 있어, 세 걸음짜리 안내보다 훨씬 낫습니다.

  다만 이 이벤트는 서비스워커가 있어야 오고, 우리는 두지 않았습니다 —
  그래서 **대개 안 옵니다.** 안 와도 안내는 그대로 뜨므로 손해는 없습니다.
  모듈 바깥에 두는 것은 React 가 뜨기 전에 이벤트가 지나가 버리기 때문입니다.
*/
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
let deferredPrompt: InstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
  });
}

export function useSurface(): Surface | null {
  const [surface, setSurface] = useState<Surface | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS 는 표준 질의를 안 받아 줍니다. 사파리만의 값이라 타입에 없습니다.
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    const ua = navigator.userAgent;
    let found = detectSurface(ua, standalone);
    // 아이패드가 스스로를 Mac 이라고 말하는 경우. 손가락 수로 가려냅니다.
    if (found === 'desktop' && looksLikeIpad(ua, navigator.maxTouchPoints)) found = 'ios';
    setSurface(found);
  }, []);

  return surface;
}

export function InstallGuide({ surface, onClose }: { surface: Surface; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (surface === 'standalone') return null;
  const recipe = RECIPES[surface];
  const app = typeof navigator !== 'undefined' ? inappName(navigator.userAgent) : null;

  const oneTap = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
    onClose();
  };

  return (
    <div className="sheet-veil" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="install-title" className="display text-lg font-bold" style={{ margin: 0 }}>
          {recipe.title}
        </h2>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-soft)', margin: '6px 0 0' }}>
          {/* 어느 앱 속인지 짚어 주면 「내 얘기구나」가 됩니다 */}
          {surface === 'inapp' && app ? `지금 ${app} 안에서 보고 있어요. ` : ''}
          {recipe.lead}
        </p>

        <ol className="install-steps">
          {recipe.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {recipe.note && (
          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
            {recipe.note}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {/* 크롬이 넘겨준 경우에만. 없으면 위 안내가 그대로 답입니다. */}
          {surface === 'android' && deferredPrompt && (
            <button className="btn btn-primary flex-1 justify-center" onClick={oneTap}>
              바로 설치하기
            </button>
          )}
          <button className="btn btn-secondary flex-1 justify-center" onClick={onClose}>
            알겠어요
          </button>
        </div>
      </div>
    </div>
  );
}

/** 더보기의 「홈 화면에 두기」. 이미 홈 화면에서 열렸으면 줄 자체를 감춥니다. */
export function InstallRow() {
  const surface = useSurface();
  const [open, setOpen] = useState(false);

  if (!surface || surface === 'standalone') return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="surface flex w-full items-center gap-4 p-4 text-left"
      >
        <div className="flex-1">
          <span className="display block text-base font-bold">홈 화면에 두기</span>
          <span className="mt-0.5 block text-xs" style={{ color: 'var(--ink-soft)' }}>
            아이가 앱처럼 바로 열 수 있어요
          </span>
        </div>
        <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
          →
        </span>
      </button>
      {open && <InstallGuide surface={surface} onClose={() => setOpen(false)} />}
    </>
  );
}

/** 「다시 보지 않기」를 눌렀는지. 카드 쪽에서 씁니다. */
export function markInstallDismissed(): void {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch {
    // 저장이 막힌 브라우저에서는 다음에 또 뜹니다. 안 뜨는 것보다 낫습니다.
  }
}
