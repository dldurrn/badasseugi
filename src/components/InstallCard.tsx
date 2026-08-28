'use client';

import { useEffect, useState } from 'react';
import {
  INSTALL_DISMISSED_KEY,
  VISITS_KEY,
  shouldOfferOnHome,
} from '@/lib/install';
import { InstallGuide, markInstallDismissed, useSurface } from './InstallGuide';

/**
 * 홈에 한 번 나오는 「홈 화면에 두기」 카드.
 *
 * 더보기에만 두면 아무도 못 찾습니다 — 부모는 자기가 무엇을 놓치고 있는지 모르니
 * 그 줄을 찾아 들어갈 까닭이 없습니다. 그렇다고 첫 방문에 들이밀면
 * **아직 뭔지도 모르는 물건을 홈 화면에 두라는 말**이 됩니다.
 * 그래서 세 번째 방문부터 한 번만 권합니다.
 *
 * 보호자 화면에만 둡니다. 아이 화면에 띄워도 아이가 할 수 있는 일이 아닙니다.
 * (아이 기기에 앉힐 때는 부모가 더보기 > 홈 화면에 두기로 들어갑니다.)
 */
export function InstallCard() {
  const surface = useSurface();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!surface) return;

    let visits = 0;
    let dismissed = false;
    try {
      /*
        홈을 열 때마다 셉니다. 서버에 두지 않는 것은 이게 「이 기기에 앉힐 것인가」의
        문제이기 때문입니다 — 부모 폰에서 설치했다고 아이 태블릿이 끝난 것이 아닙니다.
      */
      visits = Number(window.localStorage.getItem(VISITS_KEY) ?? '0') + 1;
      window.localStorage.setItem(VISITS_KEY, String(visits));
      dismissed = window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
    } catch {
      // 저장이 막힌 브라우저에서는 권하지 않습니다. 매번 뜨는 것이 최악입니다.
      return;
    }

    setShow(shouldOfferOnHome({ surface, visits, dismissed }));
  }, [surface]);

  if (!show || !surface || surface === 'standalone') return null;

  const close = () => {
    markInstallDismissed();
    setShow(false);
    setOpen(false);
  };

  return (
    <>
      <section
        className="rise-in mb-6 flex items-center gap-3 rounded p-4"
        style={{ background: 'var(--grid-tint)', border: '1px solid var(--grid)' }}
      >
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--grid-deep)' }}>
            홈 화면에 두면 앱처럼 열려요
          </p>
          <p className="mt-0.5 text-xs" style={{ margin: '2px 0 0', color: 'var(--ink-soft)' }}>
            아이 기기에 두면 주소창 없이 바로 시작해요
          </p>
        </div>
        <button className="btn btn-primary shrink-0" onClick={() => setOpen(true)}>
          방법 보기
        </button>
        <button
          className="btn btn-quiet shrink-0 px-2"
          onClick={close}
          aria-label="이 안내 그만 보기"
        >
          ✕
        </button>
      </section>

      {/* 방법을 본 뒤에는 다시 권하지 않습니다. 봤으면 그것으로 할 일을 한 것입니다. */}
      {open && <InstallGuide surface={surface} onClose={close} />}
    </>
  );
}
