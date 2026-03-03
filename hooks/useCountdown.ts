'use client';

import { useState, useEffect } from 'react';

/**
 * expiresAt (ISO string)을 받아 매초 남은 시간을 계산하는 커스텀 훅
 * @returns [minutes, seconds] 배열
 */
export function useCountdown(expiresAt: string | null): [number, number] {
  const [remaining, setRemaining] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    if (!expiresAt) return;

    function calculate() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining([0, 0]);
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setRemaining([minutes, seconds]);
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}
