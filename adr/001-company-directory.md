# ADR 001 · 국민연금 기업 DB와 월간 갱신

## 결정

Supabase Free의 PostgreSQL에 공개 기업 정보와 사용자별 CRM을 저장합니다. 앱은 Next.js 정적 빌드이며 Supabase의 공개 키로 접속합니다. 관리자 DB 연결과 국세청 API 인증키는 운영자 환경에 둡니다.

국민연금 가입 사업장 월간 파일을 기준으로 회사명, 공개 사업자번호, 사업장 주소, 업종 코드와 이름, 가입 상태·가입자 수를 저장합니다. 사업장 식별에는 공개 번호·사업장명·주소의 조합을 사용합니다. 사업자번호 일부만 공개된 경우 원본 값을 표시합니다. 사업장 이름 또는 주소가 바뀌면 새 키가 생길 수 있고, 기존 거래처는 이전 기록을 계속 참조합니다.

검색은 최신 월의 등록 사업장과 검증된 초기 업체를 대상으로 합니다. 최신 목록에서 빠진 사업장이나 탈퇴 사업장도 기존 CRM에 보존합니다. 업종 대분류는 검증한 코드 매핑으로 적용합니다. 검색 키워드는 출처 URL과 확인일을 저장한 값만 노출합니다. 대표 전화가 비어 있으면 회사명·지역을 넣은 Google 검색을 열어 사용자가 확인합니다.

## 초기 설정과 월간 운영

1. Supabase 프로젝트의 SQL Editor에서 `supabase/migrations/`의 파일을 번호 순서대로 적용합니다. 기존 프로젝트에서는 새 마이그레이션만 적용합니다.
2. `.env.example`을 `.env.local`로 복사하고 Supabase URL과 공개 키를 입력합니다. 인증 설정은 [ADR 002](002-membership-and-crm.md)를 따릅니다.
3. [국민연금 월간 CSV](https://www.data.go.kr/data/15083277/fileData.do)를 내려받습니다. 운영자 터미널에 Python 3과 `psql`을 준비하고 Supabase Connect 화면의 `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`를 설정합니다. IPv4 환경에서는 Session pooler 연결 정보를 사용합니다.
4. 프로젝트 루트에서 원본 파일을 검사하고 반영합니다. 매월 새 파일로 같은 명령을 실행합니다.

```powershell
python supabase/import_pension.py "월간파일.csv" --validate-only
python supabase/import_pension.py "월간파일.csv"
```

첫 적재부터 지역을 선택할 수 있습니다. 서울과 경기만 사용하는 예는 `--province 11 --province 41`입니다. 이후 매월 같은 범위로 월간 파일 전체를 반영합니다. `--industry-map`에는 원본 업종코드를 키로 하는 JSON 매핑을 전달합니다.

적재 도구는 UTF-8과 CP949를 지원합니다. 월간 스냅샷은 트랜잭션으로 반영하며 변경된 사업장만 다시 기록합니다. 55만 건 합성 표본 검증에서 약 312MB를 사용했습니다. 스크립트는 예상 DB 사용량 475MB에서 갱신을 중단하도록 설정되어 있습니다. 실제 파일과 월별 변경량은 운영 DB 사용량에서 확인합니다. [Supabase 무료 플랜](https://supabase.com/pricing)

국세청 운영 상태가 필요하면 운영자 터미널에 `NTS_SERVICE_KEY`를 설정하고, 전체 10자리 번호를 `python supabase/check_business_status.py 1234567890` 명령에 전달합니다. 결과는 터미널에 출력합니다. [국세청 상태조회 API](https://www.data.go.kr/data/15081808/openapi.do)

Cloudflare Pages에 배포할 때 빌드 명령은 `npm run build`, 출력 디렉터리는 `out`으로 설정합니다. 정적 빌드에 Supabase 공개 환경변수 두 개를 제공하고, 배포 주소를 Supabase 인증 리디렉션 목록에 등록합니다.
