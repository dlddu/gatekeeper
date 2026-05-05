import RequestDetailClient from './RequestDetailClient';

// Static export 시 dynamic 라우트는 미리 생성된 placeholder 한 개로 빌드한 뒤,
// Go 서버에서 어떤 /requests/{id} 경로든 이 placeholder 의 index.html 로
// fallback 시킨다. 클라이언트 컴포넌트가 useEffect 안에서 params 를 읽으므로
// 실제 id 는 fetch URL 에 그대로 반영된다.
export async function generateStaticParams() {
  return [{ id: '_placeholder' }];
}

export const dynamicParams = false;

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RequestDetailClient params={params} />;
}
