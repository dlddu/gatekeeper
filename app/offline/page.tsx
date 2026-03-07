export default function OfflinePage() {
  return (
    <main data-testid="app-shell">
      <div data-testid="offline-indicator" aria-label="오프라인">
        <h1>오프라인</h1>
        <p>인터넷 연결을 확인하고 다시 시도해 주세요.</p>
      </div>
    </main>
  );
}
