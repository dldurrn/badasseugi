'use client';

import type { SettingsPatch } from './settings';

/**
 * 설정 한 가지를 서버에 보냅니다.
 *
 * **실패해도 화면은 바뀐 채로 둡니다.**
 * 아이가 「천천히」를 눌렀는데 버튼이 도로 튀어 오르면 고장 난 것처럼 보입니다.
 * 저장이 안 된 것은 다음에 화면을 열 때 옛 값으로 돌아오는 것으로 드러나는데,
 * 그 편이 누를 때마다 실패 문구를 보는 것보다 낫습니다.
 *
 * 부르는 쪽은 기다리지 않아도 됩니다 — 눌린 느낌이 먼저여야 하니까요.
 */
export async function saveSettings(
  scope: 'family' | 'child',
  patch: SettingsPatch,
): Promise<boolean> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, ...patch }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
