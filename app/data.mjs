export const industries = ['식자재 유통사', '카페', '식품 제조업체', '화장품 업체'];
export const regions = ['경기도', '서울특별시', '인천광역시', '김포시', '용인시', '수원시', '성남시', '고양시', '화성시', '이천시', '광주시', '남양주시', '하남시', '파주시', '평택시', '안양시', '부천시', '안산시', '시흥시', '광명시', '군포시', '의왕시', '과천시', '오산시', '안성시', '양주시', '동두천시', '포천시', '여주시', '구리시', '의정부시', '연천군', '가평군', '양평군'];
export const suggestions = ['경기도 식자재 유통사', '경기도에서 직접 배송하는 식자재 유통사', '김포 지역 식품 제조업체'];

export function infer(query) {
  const industry = industries.find((value) => query.includes(value)) ||
    [['식자재', industries[0]], ['카페', industries[1]], ['식품 제조', industries[2]], ['화장품', industries[3]]].find(([word]) => query.includes(word))?.[1];
  const region = [...regions.slice(3), ...regions.slice(0, 3)].find((value) => {
    const short = value.replace(/(특별시|광역시|도|시|군)$/u, '');
    return new RegExp(`(?:^|[\\s,])${short}(?:특별시|광역시|도|시|군)?(?:에서|에|의|\\s|$|,)`, 'u').test(query);
  });
  return { industry, region };
}

export function findCompanies(rows, industry, region, delivery) {
  const seen = new Set();
  return rows.filter((row) => {
    if (row.industry !== industry || ![row.region, row.city].includes(region)) return false;
    if (delivery && !row.direct_delivery) return false;
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
