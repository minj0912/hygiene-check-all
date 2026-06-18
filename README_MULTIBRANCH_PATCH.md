# hygiene-check 멀티지점 패치 안내

이 버전은 기존 무역센터점 UI/UX와 기존 QR URL을 유지하면서 본점/천호점 지점 분기 기능을 추가한 버전입니다.

## 핵심 원칙

- `branch` 파라미터가 없는 기존 URL은 기존 무역센터점으로 동작합니다.
- 기존 무역센터점 Firestore 최상위 컬렉션(`restrooms`, `inspectionItems`, `inspections`, `complaints`)은 그대로 사용합니다.
- `branch=apgujeong`, `branch=cheonho`가 있을 때만 지점별 하위 컬렉션을 사용합니다.

## 테스트 URL

본점 관리자:

```text
https://minj0912.github.io/hygiene-check-all/?branch=apgujeong&mode=admin
```

초기 비밀번호: `0001`

천호점 관리자:

```text
https://minj0912.github.io/hygiene-check-all/?branch=cheonho&mode=admin
```

초기 비밀번호: `0003`

## 지점별 Firestore 구조

```text
branches/apgujeong/restrooms
branches/apgujeong/inspectionItems
branches/apgujeong/inspections
branches/apgujeong/complaints
branches/apgujeong/settings/auth
branches/apgujeong/settings/branch

branches/cheonho/restrooms
branches/cheonho/inspectionItems
branches/cheonho/inspections
branches/cheonho/complaints
branches/cheonho/settings/auth
branches/cheonho/settings/branch
```

## 추가 기능

- 본점/천호점 초기 화장실 목록 자동 등록
- 지점별 관리자/점검자 비밀번호
- 관리자 화면에서 지점별 비밀번호 변경
- 관리자 화면에서 화장실 추가/수정/삭제
- 관리자 화면에서 QR 링크 복사 및 QR 이미지 열기
- 관리자 화면에서 민원 접수 링크/Webhook URL 추후 입력

## 배포 참고

`vite.config.ts`의 `base`는 `./`로 설정했습니다. 따라서 `hygiene-check`와 `hygiene-check-all` 같은 다른 GitHub Pages 저장소명에서도 같은 코드로 테스트할 수 있습니다.
