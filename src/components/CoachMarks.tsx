'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  type Box,
  type CoachStep,
  type TourId,
  TOURS,
  balloonPlacement,
  spotlightBox,
  storageKey,
  visibleSteps,
} from '@/lib/coach';

/**
 * 한 번에 하나씩 짚어 주는 안내.
 *
 * 화면을 어둡게 덮되 **짚는 곳만 뚫습니다.** 구멍은 SVG 마스크가 아니라
 * 대상 크기의 빈 상자에 `box-shadow` 를 아주 넓게 준 것입니다 — 가볍고 모서리도 쉽게 둥글려집니다.
 *
 * 덮개는 `pointer-events: none` 입니다. **강조된 버튼이 실제로 눌러져야** 하니까요.
 * 설명만 읽고 끝나는 것과 그 자리에서 눌러 보는 것은 다릅니다.
 */

/** 부드러운 스크롤이 멈출 때까지 위치를 따라 재는 시간 */
const TRACK_MS = 600;

function findTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-coach="${CSS.escape(target)}"]`);
}

export function CoachMarks({ tour }: { tour: TourId }) {
  const [steps, setSteps] = useState<CoachStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [balloonPos, setBalloonPos] = useState<{ top: number; left: number } | null>(null);
  const balloonRef = useRef<HTMLDivElement>(null);

  /*
    안내가 뜨기 전에 어디에 포커스가 있었는지 기억해 뒀다가 돌려줍니다.
    세션 화면은 원고지 입력칸에 포커스를 맞춰 두는데, 안내가 그걸 가져간 채로 끝나면
    아이가 키보드를 다시 불러오려고 화면을 한 번 더 눌러야 합니다.
  */
  const returnFocus = useRef<HTMLElement | null>(null);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey(tour), '1');
    } catch {
      // 사파리 비공개 모드에서는 저장이 막힙니다. 안내를 못 여는 것보다 낫습니다.
    }
    setSteps(null);
    returnFocus.current?.focus();
  }, [tour]);

  /*
    서버에서 그릴 때는 localStorage 도 화면도 없습니다.
    뜬 뒤에 한 번 판단하고, 그때 화면에 실제로 있는 대상만 남깁니다.
  */
  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(storageKey(tour)) === '1';
    } catch {
      seen = true;
    }
    if (seen) return;

    /*
      화면이 다 그려질 때까지 한 박자 기다립니다.
      홈의 「오늘의 요약」처럼 데이터를 받아 그리는 자리가 있어,
      바로 재면 아직 없는 대상을 없다고 판단해 걸음을 통째로 건너뜁니다.
    */
    const timer = window.setTimeout(() => {
      const found = visibleSteps(TOURS[tour], (t) => findTarget(t) !== null);
      if (found.length === 0) return;
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSteps(found);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [tour]);

  const current = steps?.[index] ?? null;

  /** 대상을 화면 가운데로 데려온 뒤, 멈출 때까지 위치를 따라 잽니다. */
  useLayoutEffect(() => {
    if (!current) return;
    const el = findTarget(current.target);
    // 걸음 사이에 대상이 사라졌으면(화면이 바뀌었거나) 조용히 접습니다.
    if (!el) {
      dismiss();
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });

    let raf = 0;
    const until = performance.now() + TRACK_MS;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSpot(
        spotlightBox(
          { top: r.top, left: r.left, width: r.width, height: r.height },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
      if (performance.now() < until) raf = requestAnimationFrame(measure);
    };
    measure();

    // 스크롤이 멈춘 뒤에도 화면을 돌리거나 키보드가 올라오면 자리가 밀립니다.
    const again = () => measure();
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again, true);
    };
  }, [current, dismiss]);

  /** 말풍선은 크기를 재 봐야 어디 둘지 정할 수 있습니다. */
  useLayoutEffect(() => {
    if (!spot || !balloonRef.current) return;
    const b = balloonRef.current.getBoundingClientRect();
    const { top, left } = balloonPlacement(
      spot,
      { width: b.width, height: b.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setBalloonPos({ top, left });
  }, [spot, index]);

  const total = steps?.length ?? 0;
  const last = total > 0 && index === total - 1;

  const next = useCallback(() => {
    if (last) dismiss();
    else setIndex((i) => i + 1);
  }, [last, dismiss]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  /*
    키보드로도 넘길 수 있어야 합니다. ESC 는 언제든 빠져나가는 문입니다.

    Enter 는 일부러 받지 않습니다 — 세션 화면에서 Enter 는 「확인」이라,
    여기서도 받으면 안내를 넘기려다 답을 제출하게 됩니다.
  */
  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps, dismiss, next, back]);

  if (!steps || !current || !spot) return null;

  return (
    <div className="coach" role="dialog" aria-modal="false" aria-label="사용법 안내">
      {/* 어두운 막 = 이 상자의 그림자. 상자 안쪽만 밝게 남습니다. */}
      <div
        className="coach-hole"
        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        aria-hidden="true"
      />

      <div
        ref={balloonRef}
        className="coach-balloon"
        style={{
          // 재기 전에는 화면 밖에 두어 깜빡임을 막습니다.
          top: balloonPos?.top ?? -9999,
          left: balloonPos?.left ?? -9999,
          visibility: balloonPos ? 'visible' : 'hidden',
        }}
      >
        <div className="coach-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.target} className={i === index ? 'is-here' : i < index ? 'is-done' : ''} />
          ))}
        </div>

        <p className="coach-title display" role="status">
          {current.title}
        </p>
        <p className="coach-body">{current.body}</p>

        <div className="coach-actions">
          {last ? (
            <span className="coach-count">
              {index + 1} / {total}
            </span>
          ) : (
            <button type="button" className="btn btn-quiet coach-skip" onClick={dismiss}>
              그만 볼래요
            </button>
          )}
          {/* 포커스를 여기로 가져옵니다. 끝나면 원래 있던 자리로 돌려줍니다. */}
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>
            {last ? '알겠어요' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
