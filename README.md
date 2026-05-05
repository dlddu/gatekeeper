# gatekeeper

백엔드는 Go(`backend/`), 프론트엔드는 Next.js(`app/`).

## Backend (Go)

```bash
cd backend
go run .
```

기본 포트는 `3000`. 환경 변수:

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | SQLite 경로 (예: `file:./dev.db`) |
| `API_SECRET_KEY` | `x-api-key` 인증용 시크릿 |
| `VAPID_SUBJECT` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push 자격증명 |
| `PORT` / `HOSTNAME` | 리스너 주소 (기본: `0.0.0.0:3000`) |

마이그레이션은 시작 시 `internal/db/migrations/`의 SQL 파일을 자동으로 적용하며, 적용 이력은 `schema_migrations` 테이블에 기록됩니다.

테스트:

```bash
cd backend
go test ./...
```

## API Usage (curl)

### 승인 요청 생성

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-secret-key" \
  -d '{
    "externalId": "deploy-001",
    "context": "프로덕션 배포 승인 요청입니다.",
    "requesterName": "CI Bot",
    "timeoutSeconds": 600
  }'
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `externalId` | O | 외부 시스템의 고유 식별자 (중복 불가) |
| `context` | O | 승인 요청 내용 |
| `requesterName` | O | 요청자 이름 |
| `timeoutSeconds` | X | 자동 만료 시간 (초) |
| `userId` | X | 푸시 알림 받을 사용자 ID |

### 요청 목록 조회

```bash
curl http://localhost:3000/api/requests?status=PENDING
```

`status` 값: `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`

### 특정 요청 상세 조회

```bash
curl http://localhost:3000/api/requests/{id} \
  -H "x-api-key: your-api-secret-key"
```

### 승인 처리

```bash
curl -X PATCH http://localhost:3000/api/requests/{id}/approve \
  -H "Remote-User: alice"
```

### 거절 처리

```bash
curl -X PATCH http://localhost:3000/api/requests/{id}/reject \
  -H "Remote-User: alice"
```

`/api/me/*` 엔드포인트는 모두 forward-auth(`Remote-User`, `Remote-Email`, `Remote-Name`) 헤더를 요구합니다.
