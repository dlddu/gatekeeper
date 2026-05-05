'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Static export 와 호환되는 클라이언트 redirect.
// 서버 측 redirect() 를 쓰면 next build --output=export 가 / 에 대해
// 404 페이지를 생성하므로 SW 등록 스크립트도 실행되지 못한다.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/requests');
  }, [router]);

  return null;
}
