export const industryGroups = {
  '식품·외식': ['식자재 유통사', '카페', '식품 제조업체', '베이커리', '음식점', '단체급식', '주류 유통', '축산물 가공', '반찬가게'],
  '뷰티·생활': ['화장품 업체', '미용실', '네일숍', '피부관리실', '세탁소', '반려동물용품', '꽃집'],
  '제조·산업': ['전자부품 제조', '금속 가공', '가구 제조', '포장재 제조', '의류 제조', '산업기계', '자동차 부품', '인쇄소'],
  '유통·물류': ['물류센터', '화물 운송', '택배', '도매업체', '온라인 쇼핑몰', '편의점', '생활용품점'],
  '공간·건설': ['인테리어', '건축사무소', '건설사', '조경', '부동산 중개', '시설 관리', '공유오피스'],
  '교육·건강': ['학원', '어린이집', '헬스장', '필라테스', '병원', '약국', '동물병원'],
  '기업 서비스': ['소프트웨어 개발', '디자인 스튜디오', '광고대행사', '세무사무소', '회계법인', '영상 제작', '행사 기획', '채용 대행'],
  '여가·숙박': ['호텔', '펜션', '여행사', '캠핑장', '공연장', '사진관']
};
export const industries = Object.values(industryGroups).flat();
const provinces = ['경기도', '서울특별시', '인천광역시', '부산광역시', '대구광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'];
const gyeonggi = ['김포시', '용인시', '수원시', '성남시', '고양시', '화성시', '이천시', '광주시', '남양주시', '하남시', '파주시', '평택시', '안양시', '부천시', '안산시', '시흥시', '광명시', '군포시', '의왕시', '과천시', '오산시', '안성시', '양주시', '동두천시', '포천시', '여주시', '구리시', '의정부시', '연천군', '가평군', '양평군'];
export const regionGroups = { 광역: provinces, 경기권: gyeonggi };
export const regions = [...provinces, ...gyeonggi];

export function infer(query) {
  const industry = industries.toSorted((a, b) => b.length - a.length).find((value) => query.includes(value)) ||
    [['식자재', industries[0]], ['카페', industries[1]], ['식품 제조', industries[2]], ['화장품', '화장품 업체']].find(([word]) => query.includes(word))?.[1];
  const bySuffix = (value) => regionTerm(value, false).test(query);
  const region = [...gyeonggi, ...provinces].find(bySuffix) || [...provinces, ...gyeonggi].find((value) => regionTerm(value).test(query));
  return { industry, region };
}

export function regionTerm(value, includeShort = true) {
  const short = value.replace(/(?:특별자치[시도]|특별시|광역시|[도시군])$/u, '');
  return new RegExp(`(?:^|[\\s,])${includeShort ? `(?:${value}|${short})` : value}(?:에서|에|의)?(?=[\\s,]|$)`, 'u');
}

export function findCompanies(rows, industry, region) {
  const seen = new Set();
  return rows.filter((row) => {
    if (row.industry !== industry || ![row.region, row.city].includes(region)) return false;
    const key = [row.name, row.address || row.city || row.region].join('|').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}|]/gu, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toCsv(rows, saved) {
  const columns = ['업체명', '업종', '지역', '주소', '대표전화', '이메일', '홈페이지', '출처', '확인일', '근거', '메모'];
  const escape = (value) => {
    let cell = String(value ?? '');
    if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(cell)) cell = "'" + cell;
    return '"' + cell.replaceAll('"', '""') + '"';
  };
  const lines = rows.map((row) => [row.name, row.industry, [row.region, row.city].filter(Boolean).join(' '), row.address, row.phone, row.email, row.website, row.source_url, row.verified_on, row.evidence, saved[row.id]?.note]);
  return '\uFEFF' + [columns, ...lines].map((line) => line.map(escape).join(',')).join('\r\n');
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
