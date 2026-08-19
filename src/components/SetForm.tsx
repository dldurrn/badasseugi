'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
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
  const [scanning, setScanning] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const scan = async (file: File) => {
    setScanning(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch('/api/ocr', { method: 'POST', body: form });
      const payload = (await response.json().catch(() => null)) as
        | { sentences?: string[]; error?: string }
        | null;

      if (!response.ok || !payload?.sentences) {
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
      append(payload.sentences);
      setNotice({
        kind: 'info',
        text: `${payload.sentences.length}문장을 찾았어요. 맞는지 한 번 확인해 주세요.`,
      });
    } catch {
      setNotice({ kind: 'error', text: '사진을 보내지 못했어요. 연결을 확인해 주세요.' });
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
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
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className="btn btn-secondary flex-1 justify-center"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
        >
          {scanning ? '읽는 중…' : '사진에서 가져오기'}
        </button>
        <button
          type="button"
          className="btn btn-secondary flex-1 justify-center"
          onClick={() => setShowBulk((v) => !v)}
        >
          여러 줄 붙여넣기
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
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
