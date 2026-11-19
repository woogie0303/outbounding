# 아웃바운딩

업종과 지역으로 공개 출처가 있는 업체를 찾고 영업 메모와 CSV를 관리하는 Next.js 앱입니다.

## 로컬 실행

Node.js 22 이상을 사용합니다.

```sh
npm ci
npm run dev
```

http://localhost:3000 에서 열립니다. 환경변수를 비워두면 확인된 초기 업체 4개를 검색할 수 있으며 저장과 메모는 현재 브라우저에 보관됩니다. 검색 지역은 사업장 소재지 기준입니다. 직접 배송으로 검색하면 공식 출처에 자체 차량 배송이 확인된 업체만 표시합니다. 업체는 등록된 디렉터리 범위에서 검색하며, 새로운 업체의 실시간 웹 검색은 지원하지 않습니다.

## Supabase Free 연결

1. [Supabase](https://supabase.com/pricing)에서 Free 조직에 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/migrations/001_initial.sql`과 `002_seed.sql`을 순서대로 실행합니다. 새 업체는 공개 정보와 사용 가능한 원문 링크, 확인 날짜를 검증한 후 `companies`에 추가합니다.
3. Authentication의 **Allow anonymous sign-ins**를 켭니다. 저장 시 현재 브라우저에 익명 세션이 생성되며 Supabase RLS로 계정별 저장 목록과 메모를 분리합니다. 브라우저 저장소 또는 세션을 삭제하면 그 익명 저장 목록에 다시 접속할 수 없습니다. 최근 검색은 현재 브라우저에 보관됩니다.
4. `.env.example`을 `.env.local`로 복사하고 프로젝트 URL과 공개용 publishable key를 입력합니다. secret key나 service role key는 프런트엔드에 입력하지 않습니다.

## 무료 웹 배포

Cloudflare Pages Free에서 이 저장소를 연결하고 빌드 명령을 `npm run build`, 출력 디렉터리를 `out`으로 지정합니다. Pages 프로젝트의 환경 변수에 Supabase 공개 설정 두 개를 추가하고 기본 `pages.dev` 주소를 사용합니다. 정적 빌드 결과는 다른 무료 정적 호스팅에서도 제공할 수 있습니다.

유료 조사 API, AI API, 유료 도메인 또는 과금 기능을 사용하지 않습니다. Supabase Free는 무료 할당량과 비활성 프로젝트 일시중지 정책이 적용됩니다. [Supabase 요금표](https://supabase.com/pricing) · [Cloudflare Pages 한도](https://developers.cloudflare.com/pages/platform/limits/)
