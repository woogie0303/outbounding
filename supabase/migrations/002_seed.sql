insert into public.companies (id, name, industry, region, city, address, phone, email, website, source_url, verified_on, evidence, direct_delivery) values
  ('garamfood', '참가람푸드', '식자재 유통사', '경기도', '남양주시', null, null, null, 'https://garamfood.co.kr/ko', 'https://garamfood.co.kr/ko/about', '2026-11-19', '회사 소개에 남양주 본사와 서울·경기 외식업체 대상 종합 식자재 납품, 자사 차량 배송 권역이 명시되어 있습니다.', true),
  ('freshone', '프레시원 강남', '식자재 유통사', '경기도', '용인시', '경기도 용인시 수지구 손곡로 20', '1660-1033', null, 'https://freshone.com/', 'https://freshone.com/', '2026-11-19', '공식 홈페이지에서 용인 강남 거점과 물류센터 기반 식자재 배송을 안내합니다.', false),
  ('kimpomaca', '김포맥아식품', '식품 제조업체', '경기도', '김포시', '경기도 김포시 하성면 가금로 421', '031-998-0969', null, 'https://kimpomaca.co.kr/', 'https://kimpomaca.co.kr/', '2026-11-19', '공식 홈페이지에 김포 공장 주소와 엿기름 및 곡물 가공식품 제조 안내가 있습니다.', false),
  ('daewoonfood', '대운푸드시스템', '식품 제조업체', '경기도', '김포시', '경기도 김포시 옹주물로 31-38', null, null, 'http://www.daewoonfood.com', 'https://www.gimpo.go.kr/portal/selectBbsNttView.do?bbsNo=500&key=1302&nttNo=733712', '2026-11-19', '김포시 기업소개에 김포 사업장과 냉동 수산식품·공산품 생산이 기재되어 있습니다.', false)
on conflict (id) do nothing;
