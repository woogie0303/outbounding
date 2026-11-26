# ADR 002 · 소셜 가입, 체험 한도와 거래처 담당자

## 결정

- 체험 사용자는 최초 검색이나 저장 때 Supabase 익명 세션을 발급받습니다. 한 익명 계정에서 검색 열 번과 거래처 다섯 개까지 사용할 수 있습니다. 검색 결과가 비어 있어도 정상 처리된 검색은 한 번으로 계산하며, 같은 검색의 다음 페이지는 그대로 열 수 있습니다. 저장 한도는 현재 저장된 서로 다른 거래처 수를 기준으로 합니다.
- 검색 횟수는 데이터베이스의 제한된 RPC에서 계산하고, 저장 한도는 DB 트리거로 적용합니다. 비회원은 일반 기업 테이블에서 자기 거래처만 조회할 수 있습니다. 익명 세션을 잃거나 브라우저를 바꾸면 별개의 체험 계정이 됩니다. Supabase 미연결 로컬 화면은 브라우저 기반 체험입니다.
- 네이버 OIDC, 카카오, Google로 가입하거나 로그인합니다. 체험 상태에서 새 계정을 연결하면 동일한 사용자 ID를 유지하므로 저장 목록과 메모가 이어집니다. 이미 존재하는 계정으로 로그인하는 경로에서는 해당 회원의 저장 데이터를 조회합니다.
- 거래처의 담당자를 추가·수정·삭제할 수 있습니다. 기존 단일 담당자 정보는 `004_membership_and_contacts.sql`에서 여러 행을 가질 수 있는 `lead_contacts`로 이전합니다. 담당자와 연락 이력은 해당 거래처를 저장한 계정만 접근합니다.
- 주변 업체와 현재 위치는 가입한 사용자만 사용할 수 있습니다. 위치 데이터에도 회원 전용 RLS를 적용합니다. 좌표는 검증한 출처와 함께 `company_locations`에 넣으며 국민연금 파일은 좌표를 제공하지 않습니다. 현재 위치는 기기에서 요청하고, 앱은 지도 반경 조회에 필요한 좌표 범위를 Supabase로 보냅니다.

## 운영 설정

1. 마이그레이션 `004_membership_and_contacts.sql`을 적용하고 Supabase Auth에서 새 사용자 가입, **Allow anonymous sign-ins**, **Allow manual linking**을 켭니다.
2. Supabase URL Configuration에 운영 앱 주소와 개발용 `http://localhost:3000/`을 등록합니다. 제공자 콘솔의 콜백 주소에는 Supabase 대시보드에 표시되는 Auth 콜백을 복사합니다. 앱으로 돌아오는 주소와 제공자 콜백 주소는 각 콘솔의 지정된 항목에서 설정합니다.
3. Google과 카카오는 Supabase 내장 제공자를 사용하고 각 콘솔에서 발급받은 Client ID와 시크릿을 Supabase에 등록합니다. 카카오 계정 이메일 접근 권한이 없으면 Supabase 카카오 설정의 이메일 없는 사용자 허용 옵션을 사용합니다. [Google 설정](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [카카오 설정](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao)
4. 네이버는 Custom Provider의 OIDC 자동 검색으로 등록합니다. 식별자는 `custom:naver`, issuer는 `https://nid.naver.com`, scope는 `openid profile`입니다. 네이버 로그인 앱에서 OIDC를 사용하고, Supabase의 `email_optional`을 켭니다. 네이버 OIDC 토큰에서 이메일을 요구하지 않고 발급자의 사용자 식별자를 사용합니다. [Supabase Custom Provider](https://supabase.com/docs/guides/auth/custom-oauth-providers) · [네이버 OIDC 설정](https://developers.naver.com/docs/login/devguide)
5. 테스트용 계정으로 제공자별 신규 가입, 체험 거래처 유지, 기존 회원 로그인과 로그아웃을 확인합니다. 위치 목록은 출처와 좌표가 등록된 뒤 확인합니다.
