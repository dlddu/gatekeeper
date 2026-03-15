# gatekeeper

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
  -H "Authorization: Bearer {jwt-token}"
```

### 거절 처리

```bash
curl -X PATCH http://localhost:3000/api/requests/{id}/reject \
  -H "Authorization: Bearer {jwt-token}"
```