'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { prepareImageForUpload } from '@/lib/prepare-image';
import { MAX_SENTENCES, SENTENCE_MAX, SET_NAME_MAX } from '@/lib/sets';

/**
 * 받아쓰기 세트 만들기·고치기 (보호자 화면).
 *
 * 여기서 넣은 문장이 그대로 채점 기준이 됩니다.
 * 그래서 입력칸의 브라우저 교정을 끕니다.
 * 부모가 적은 "돼요"를 브라우저가 조용히 "되요"로 바꾸면
 * 아이는 맞게 쓰고도 틀렸다는 채점을 받게 됩니다.
 *
 * 문장을 넣는 길을 셋으로 둔 것은, 문제지 사진이 잘 안 읽힐 때
 * 막다른 길이 되지 않게 하기 위해서입니다.
 */

/**
 * 사진 인식은 10초 넘게 걸리기도 합니다.
 * "읽는 중…" 한 마디만 띄우면 멈춘 것처럼 보여서, 지금 무슨 일이 일어나는지 단계로 보여 줍니다.
 * 실제 시간이 줄지는 않지만 기다리는 느낌이 크게 달라집니다.
 */
type ScanPhase = 'prepare' | 'upload' | 'read';

interface OcrPayload {
  sentences?: string[];
  corrections?: Correction[];
  uncertain?: Uncertain[];
  error?: string;
}

/**
 * fetch 대신 XMLHttpRequest를 쓰는 이유는 하나뿐입니다 — **올려보내는 진행률**.
 * fetch로는 요청 본문이 얼마나 갔는지 알 수 없어서
 * "보내는 중"과 "읽는 중"을 나눠 보여 줄 수가 없습니다.
 * 폰 데이터로 사진을 올리면 이 구간이 몇 초씩 걸리기 때문에 나눌 값어치가 있습니다.
 */
function postImage(
  file: File,
  onProgress: (percent: number) => void,
  onSent: () => void,
): Promise<{ ok: boolean; payload: OcrPayload | null }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('image', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/ocr');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    // 본문을 다 올린 시점 = 서버가 읽기 시작하는 시점입니다.
    xhr.upload.onload = () => {
      onProgress(100);
      onSent();
    };

    xhr.onload = () => {
      let payload: OcrPayload | null = null;
      try {
        payload = JSON.parse(xhr.responseText) as OcrPayload;
      } catch {
        payload = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, payload });
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));

    xhr.send(form);
  });
}

const SCAN_STEPS: { phase: ScanPhase; label: string }[] = [
  { phase: 'prepare', label: '사진 줄이는 중' },
  { phase: 'upload', label: '보내는 중' },
  { phase: 'read', label: '글자 읽는 중' },
];

/**
 * 어느 단계인지 원고지 칸으로 보여 줍니다.
 * 채운 칸 = 끝난 것, 테두리 칸 = 지금 하는 것 — 채점 화면과 같은 약속입니다.
 */
function ScanProgress({
  phase,
  percent,
  elapsed,
}: {
  phase: ScanPhase;
  percent: number;
  elapsed: number;
}) {
  const now = SCAN_STEPS.findIndex((s) => s.phase === phase);

  return (
    <div
      className="mb-3 rounded-sm p-3"
      style={{ background: 'var(--paper-sunk)', border: '1px solid var(--rule)' }}
      role="status"
      aria-live="polite"
    >
      <ul className="flex flex-col gap-2">
        {SCAN_STEPS.map((step, i) => {
          const done = i < now;
          const current = i === now;
          return (
            <li key={step.phase} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className="grid h-5 w-5 shrink-0 place-content-center rounded-sm text-[11px] font-bold"
                style={
                  done
                    ? { background: 'var(--grid)', color: 'var(--card)' }
                    : current
                      ? { border: '1.5px solid var(--grid)', color: 'var(--grid-deep)' }
                      : { border: '1px solid var(--rule-strong)', color: 'var(--ink-faint)' }
                }
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                style={{
                  color: current ? 'var(--ink)' : done ? 'var(--ink-soft)' : 'var(--ink-faint)',
                  fontWeight: current ? 700 : 400,
                }}
              >
                {step.label}
              </span>

              {/* 올려보내는 중에는 얼마나 갔는지 막대로 보여 줍니다 */}
              {step.phase === 'upload' && current && (
                <span className="flex flex-1 items-center gap-2">
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: 'var(--rule-strong)' }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${percent}%`, background: 'var(--grid)' }}
                    />
                  </span>
                  <span
                    className="tabular-nums text-xs"
                    style={{ color: 'var(--ink-soft)', minWidth: '2.5rem', textAlign: 'right' }}
                  >
                    {percent}%
                  </span>
                </span>
              )}

              {/* 읽는 동안은 진행률을 알 수 없어서, 멈춘 게 아니라는 표시로 초를 셉니다 */}
              {step.phase === 'read' && current && (
                <span className="tabular-nums text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {elapsed}초
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {phase === 'read' && (
        <p className="mt-2.5 text-xs" style={{ color: 'var(--ink-faint)' }}>
          글자가 많으면 20초까지 걸리기도 해요. 그대로 두고 기다려 주세요.
        </p>
      )}
    </div>
  );
}

interface Correction {
  index: number;
  from: string;
  to: string;
  why: string;
}

interface Uncertain {
  index: number;
  why: string;
}

interface Review {
  corrections: Correction[];
  uncertain: Uncertain[];
}

interface SetFormProps {
  defaultName: string;
  initial?: { id: string; name: string; sentences: string[] };
}

export function SetForm({ defaultName, initial }: SetFormProps) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? defaultName);
  const [sentences, setSentences] = useState<string[]>(
    initial?.sentences.length ? initial.sentences : [''],
  );
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<ScanPhase | null>(null);
  const [percent, setPercent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const scanning = phase !== null;
  /** 방금 사진에서 가져온 문장 수. 확인을 마치면 0으로 돌아갑니다. */
  const [justScanned, setJustScanned] = useState(0);
  /** AI가 고쳤거나 미심쩍어한 곳. 부모가 확인해야 할 자리입니다. */
  const [review, setReview] = useState<Review>({ corrections: [], uncertain: [] });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // 앨범과 카메라는 입력칸을 따로 둬야 합니다. capture 속성이 달라서요.
  const albumRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const filled = sentences.map((s) => s.trim()).filter(Boolean);
  const canSave = name.trim().length > 0 && filled.length > 0 && !busy;

  const update = (index: number, value: string) => {
    setSentences((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const removeAt = (index: number) => {
    setSentences((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sentences.length) return;
    setSentences((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const append = (list: string[]) => {
    setSentences((prev) => {
      // 비어 있는 줄은 새로 넣는 문장으로 채웁니다.
      const kept = prev.filter((s) => s.trim().length > 0);
      return [...kept, ...list].slice(0, MAX_SENTENCES);
    });
  };

  const applyBulk = () => {
    const list = bulk
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim()) // "1. " 같은 문제 번호 제거
      .filter(Boolean);
    if (list.length === 0) return;
    append(list);
    setBulk('');
    setShowBulk(false);
    setNotice({ kind: 'info', text: `${list.length}문장을 넣었어요.` });
  };

  // "글자 읽는 중"일 때만 초를 셉니다. 앞 단계는 금방 지나가서 셀 것도 없습니다.
  useEffect(() => {
    if (phase !== 'read') return;
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const scan = async (file: File) => {
    setPhase('prepare');
    setPercent(0);
    setElapsed(0);
    setNotice(null);
    setJustScanned(0);
    try {
      // 보내기 전에 브라우저에서 줄입니다.
      // 폰 사진은 그대로 보내면 Vercel의 4.5MB 제한에 걸려 서버에 닿지도 못합니다.
      let prepared: File;
      try {
        prepared = await prepareImageForUpload(file);
      } catch {
        setNotice({
          kind: 'error',
          text: '이 사진 형식은 읽을 수 없어요. 아이폰이라면 설정 > 카메라 > 포맷을 "높은 호환성"으로 바꾸고 다시 찍어 주세요.',
        });
        return;
      }

      setPhase('upload');
      const { ok, payload } = await postImage(prepared, setPercent, () => setPhase('read'));

      if (!ok || !payload?.sentences) {
        setNotice({
          kind: 'error',
          text: payload?.error ?? '사진을 읽지 못했어요. 직접 입력으로 넣어 주세요.',
        });
        return;
      }
      if (payload.sentences.length === 0) {
        setNotice({
          kind: 'error',
          text: '사진에서 문장을 찾지 못했어요. 밝은 곳에서 다시 찍거나 직접 입력해 주세요.',
        });
        return;
      }
      // 붙이기 전의 길이를 알아야 AI가 준 자리 번호를 우리 목록 번호로 옮길 수 있습니다.
      const offset = sentences.filter((s) => s.trim().length > 0).length;
      append(payload.sentences);

      // 사진 인식은 틀릴 수 있고, 여기 들어간 문장이 그대로 채점 기준이 됩니다.
      // 부모가 확인하지 않고 저장하면 아이가 맞게 쓰고도 틀렸다는 채점을 받습니다.
      // 그래서 이 안내만은 눈에 확 띄게 따로 띄웁니다.
      setNotice(null);
      setJustScanned(payload.sentences.length);
      setReview({
        corrections: (payload.corrections ?? []).map((c) => ({ ...c, index: c.index + offset })),
        uncertain: (payload.uncertain ?? []).map((u) => ({ ...u, index: u.index + offset })),
      });
    } catch {
      setNotice({ kind: 'error', text: '사진을 보내지 못했어요. 연결을 확인해 주세요.' });
    } finally {
      setPhase(null);
      // 같은 사진을 다시 고를 수 있게 값을 비웁니다.
      if (albumRef.current) albumRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const save = async () => {
    setBusy(true);
    setNotice(null);
    const response = await fetch(editing ? `/api/sets/${initial!.id}` : '/api/sets', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), sentences: filled }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setNotice({ kind: 'error', text: payload?.error ?? '저장하지 못했어요.' });
      setBusy(false);
      return;
    }

    router.replace('/dictation');
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    const response = await fetch(`/api/sets/${initial!.id}`, { method: 'DELETE' });
    if (!response.ok) {
      setNotice({ kind: 'error', text: '지우지 못했어요. 잠시 후 다시 시도해 주세요.' });
      setBusy(false);
      return;
    }
    router.replace('/dictation');
    router.refresh();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save();
      }}
    >
      <h2 className="section-title mb-2">세트 이름</h2>
      <input
        className="field mb-6"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={SET_NAME_MAX}
        placeholder="예: 3월 둘째 주 받아쓰기"
        spellCheck={false}
        autoCorrect="off"
        required
      />

      <h2 className="section-title mb-2">문장 넣기</h2>
      {/*
        앨범과 카메라를 버튼 두 개로 나눕니다.
        `capture` 속성이 붙으면 폰이 카메라를 바로 열고, 없으면 앨범을 엽니다.
        한 입력칸으로는 둘 다 못 하므로 입력칸도 둘로 나눕니다.
        (PC에서는 카메라 버튼도 파일 선택창이 열립니다 — 그래서 앨범을 앞에 둡니다.)
      */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-secondary justify-center"
          onClick={() => albumRef.current?.click()}
          disabled={scanning}
        >
          {scanning ? '읽는 중…' : '앨범에서 고르기'}
        </button>
        <button
          type="button"
          className="btn btn-secondary justify-center"
          onClick={() => cameraRef.current?.click()}
          disabled={scanning}
        >
          {scanning ? '읽는 중…' : '사진 찍기'}
        </button>
      </div>

      {phase && <ScanProgress phase={phase} percent={percent} elapsed={elapsed} />}
      <button
        type="button"
        className="btn btn-secondary mb-3 w-full justify-center"
        onClick={() => setShowBulk((v) => !v)}
      >
        여러 줄 붙여넣기
      </button>

      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void scan(file);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void scan(file);
        }}
      />

      {showBulk && (
        <div className="rise-in mb-3">
          <textarea
            className="field"
            rows={5}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'한 줄에 한 문장씩 붙여넣어 주세요.\n오늘은 날씨가 맑습니다.\n친구와 함께 놀았어요.'}
            spellCheck={false}
            autoCorrect="off"
          />
          <button type="button" className="btn btn-secondary mt-2" onClick={applyBulk}>
            줄마다 문장으로 넣기
          </button>
        </div>
      )}

      {justScanned > 0 && (
        <div
          className="rise-in mb-3 rounded p-4"
          style={{
            background: 'var(--pen-tint)',
            border: '2px solid var(--pen)',
          }}
          role="status"
        >
          <p
            className="display text-base font-bold"
            style={{ color: 'var(--pen-deep)', margin: 0 }}
          >
            사진에서 {justScanned}문장을 가져왔어요
          </p>
          <p
            className="mt-1.5 text-sm leading-relaxed"
            style={{ color: 'var(--pen-deep)', margin: '6px 0 0' }}
          >
            <b>글자가 맞는지 꼭 확인해 주세요.</b> 사진은 잘못 읽힐 수 있어요.
            여기 적힌 문장이 그대로 채점 기준이 되기 때문에,
            틀린 채로 두면 아이가 바르게 쓰고도 틀렸다고 나와요.
          </p>
          {/* AI가 고친 곳 — 무엇을 어떻게 바꿨는지 드러내고 되돌릴 길을 줍니다. */}
          {review.corrections.length > 0 && (
            <div className="mt-3.5">
              <p className="text-[13px] font-bold" style={{ color: 'var(--pen-deep)', margin: 0 }}>
                이렇게 고쳤어요 · 맞는지 봐 주세요
              </p>
              <ul className="mt-1.5 flex list-none flex-col gap-1.5 p-0">
                {review.corrections.map((c) => (
                  <li
                    key={`${c.index}-${c.from}`}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm px-2.5 py-2 text-[13px]"
                    style={{ background: 'var(--card)' }}
                  >
                    <span className="tabular-nums" style={{ color: 'var(--ink-faint)' }}>
                      {c.index + 1}번
                    </span>
                    <span style={{ color: 'var(--ink-faint)', textDecoration: 'line-through' }}>
                      {c.from || '(빈칸)'}
                    </span>
                    <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
                      →
                    </span>
                    <span className="font-semibold">{c.to}</span>
                    {c.why && (
                      <span className="w-full text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                        {c.why}
                      </span>
                    )}
                    {c.from && (
                      <button
                        type="button"
                        className="ml-auto shrink-0 px-1 text-[12px] font-semibold"
                        style={{ color: 'var(--pen)' }}
                        onClick={() => {
                          update(c.index, c.from);
                          setReview((r) => ({
                            ...r,
                            corrections: r.corrections.filter((x) => x !== c),
                          }));
                        }}
                      >
                        되돌리기
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI도 확신하지 못한 곳 — 고치지는 않았지만 눈으로 봐야 합니다. */}
          {review.uncertain.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] font-bold" style={{ color: 'var(--pen-deep)', margin: 0 }}>
                이 줄은 흐려서 확실하지 않아요
              </p>
              <ul className="mt-1.5 flex list-none flex-col gap-1 p-0 text-[13px]">
                {review.uncertain.map((u) => (
                  <li key={u.index} style={{ color: 'var(--ink-soft)' }}>
                    <span className="tabular-nums">{u.index + 1}번</span>
                    {u.why ? ` · ${u.why}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="btn mt-3"
            style={{ background: 'var(--pen)', color: '#fff' }}
            onClick={() => {
              setJustScanned(0);
              setReview({ corrections: [], uncertain: [] });
            }}
          >
            확인했어요
          </button>
        </div>
      )}

      <ul className="mb-3 flex flex-col gap-2">
        {sentences.map((sentence, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <span
              className="w-5 shrink-0 text-right text-xs tabular-nums"
              style={{ color: 'var(--ink-faint)' }}
            >
              {index + 1}
            </span>
            <input
              className="field"
              value={sentence}
              onChange={(e) => update(index, e.target.value)}
              maxLength={SENTENCE_MAX}
              placeholder="문장을 그대로 적어 주세요"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`${index + 1}번째 문장 위로`}
                className="px-1.5 text-xs"
                style={{ color: 'var(--ink-faint)' }}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === sentences.length - 1}
                aria-label={`${index + 1}번째 문장 아래로`}
                className="px-1.5 text-xs"
                style={{ color: 'var(--ink-faint)' }}
              >
                ▼
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={`${index + 1}번째 문장 지우기`}
              className="shrink-0 px-2"
              style={{ color: 'var(--pen)' }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => setSentences((prev) => [...prev, ''])}
          disabled={sentences.length >= MAX_SENTENCES}
        >
          ＋ 문장 추가
        </button>
        <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
          {filled.length} / {MAX_SENTENCES}
        </span>
      </div>

      {notice && (
        <p
          className="mb-4 rounded-sm p-3 text-center text-sm"
          style={
            notice.kind === 'error'
              ? { background: 'var(--pen-tint)', color: 'var(--pen-deep)' }
              : { background: 'var(--grid-tint)', color: 'var(--grid-deep)' }
          }
          role="status"
        >
          {notice.text}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-lg" disabled={!canSave}>
        {editing ? '저장하기' : '세트 만들기'}
      </button>

      {editing && (
        <div className="mt-8 border-t pt-5" style={{ borderColor: 'var(--rule)' }}>
          {confirmingDelete ? (
            <div className="rise-in text-center">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--pen-deep)' }}>
                이 세트를 지우면 다시 풀 수 없어요.
                <br />
                이미 푼 점수 기록은 그대로 남아요.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmingDelete(false)}
                >
                  그만두기
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'var(--pen)', color: '#fff' }}
                  onClick={remove}
                  disabled={busy}
                >
                  지우기
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-quiet w-full justify-center"
              style={{ color: 'var(--pen)' }}
              onClick={() => setConfirmingDelete(true)}
            >
              이 세트 지우기
            </button>
          )}
        </div>
      )}
    </form>
  );
}
