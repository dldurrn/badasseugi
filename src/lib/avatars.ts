/**
 * 프로필 그림.
 *
 * 사진이나 이름 대신 그림으로 프로필을 구분합니다.
 * 아이가 글자를 못 읽어도 자기 칸을 찾을 수 있어야 하고,
 * 아동 개인정보를 남기지 않기 위한 선택이기도 합니다.
 */
export const AVATARS = [
  '🐣',
  '🐰',
  '🐻',
  '🦊',
  '🐨',
  '🐯',
  '🐼',
  '🦁',
  '🐸',
  '🐧',
  '🐢',
  '🦄',
] as const;

export const DEFAULT_AVATAR = AVATARS[0];

export function isAllowedAvatar(value: unknown): value is string {
  return typeof value === 'string' && (AVATARS as readonly string[]).includes(value);
}
