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

## 추가 지점 초기 설정

아래 지점은 `branch` URL 파라미터로 접속합니다. 각 지점의 초기 관리자/점검자 비밀번호는 동일하게 설정되어 있으며, 관리자 화면에서 이후 변경할 수 있습니다.

| 지점 | branch | 초기 비밀번호 |
|---|---|---:|
| 압구정 본점 | apgujeong | 1111 |
| 천호점 | cheonho | 1113 |
| 신촌점 | sinchon | 1114 |
| 미아점 | mia | 1115 |
| 목동점 | mokdong | 1116 |
| 중동점 | jungdong | 1117 |
| 킨텍스점 | kintex | 1118 |
| 울산점 | ulsan | 1119 |
| 더현대 대구점 | thehyundai_daegu | 1120 |
| 충청점 | chungcheong | 1121 |
| 판교점 | pangyo | 1122 |
| 더현대서울 | thehyundai_seoul | 1123 |
| 김포아울렛 | gimpo_outlet | 1124 |
| 송도아울렛 | songdo_outlet | 1125 |
| 대전 아울렛 | daejeon_outlet | 1126 |
| SPACE 1 | space1 | 1127 |
| 동대문 아울렛 | dongdaemun_outlet | 1128 |
| 가든파이브 | garden5 | 1129 |
| 대구 아울렛 | daegu_outlet | 1130 |
| 가산 아울렛 | gasan_outlet | 1131 |
| 커넥트 현대 부산 | connect_busan | 1132 |
| 커넥트 현대 청주 | connect_cheongju | 1133 |

신규 추가 지점의 기본 화장실은 `B1층 남자화장실`, `B1층 여자화장실` 2개입니다. 압구정 본점과 천호점은 이전에 입력한 초기 화장실 목록을 유지했습니다.
