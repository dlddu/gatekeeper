import RequestDetailClient from './RequestDetailClient';

// Static export 시 dynamic 라우트는 미리 생성된 placeholder 한 개로 빌드한 뒤,
// Go 서버에서 어떤 /requests/{id} 경로든 이 placeholder 의 index.html 로
// fallback 시킨다. 클라이언트 컴포넌트가 useEffect 안에서 window.location 으로
// 실제 id 를 읽어 fetch URL 에 그대로 반영한다.
//
// dynamicParams 를 false 로 두면 Next.js client router 가 /requests/_placeholder
// 외의 모든 id 를 NotFound 로 처리해 hydration 이후 detail UI 가 렌더링되지
// 않으므로, 기본값(true) 그대로 둔다.
export async function generateStaticParams() {
  return [{ id: '_placeholder' }];
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RequestDetailClient params={params} />;
}
