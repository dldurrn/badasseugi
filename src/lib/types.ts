/** 앱 전역에서 쓰는 도메인 타입. DB 스키마와 짝을 이룹니다. */

export type Module = 'dictation' | 'spelling';
export type Mode = 'practice' | 'exam';

/**
 * 화면에 내려보내는 자녀 프로필.
 * PIN 해시는 담지 않습니다. 잠금이 걸려 있는지(hasPin)만 알면 됩니다.
 */
export interface ChildProfile {
  id: string;
  nickname: string;
  avatar: string;
  hasPin: boolean;
}

export interface DictationSet {
  id: string;
  name: string;
  sentences: string[];
  createdAt: string;
}

export interface Attempt {
  id: string;
  childId: string;
  module: Module;
  mode: Mode;
  setId: string | null;
  score: number;
  correctCount: number;
  totalCount: number;
  createdAt: string;
}

export interface Trophy {
  id: string;
  childId: string;
  kind: 'gold' | 'silver';
  emblem: string;
  label: string | null;
  sourceName: string | null;
  score: number;
  createdAt: string;
}
