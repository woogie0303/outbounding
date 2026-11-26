"""Load one complete monthly National Pension CSV through a PostgreSQL connection."""

import argparse
import csv
from datetime import date
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata


PROVINCES = dict(zip(
    ("11", "26", "27", "28", "29", "30", "31", "36", "41", "42", "43", "44", "45", "46", "47", "48", "50", "51", "52"),
    ("서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시",
     "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도",
     "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
     "강원특별자치도", "전북특별자치도"),
))
HEADERS = {
    "month": "자료생성년월",
    "name": "사업장명",
    "number": "사업자등록번호",
    "status": "사업장가입상태코드",
    "road": "사업장도로명상세주소",
    "lot": "사업장지번상세주소",
    "province": "법정동주소광역시도코드",
    "industry_code": "사업장업종코드",
    "industry": "사업장업종코드명",
    "employees": "가입자수",
}


def normalize(value):
    return " ".join(unicodedata.normalize("NFKC", value or "").split())


def read_csv(source, province_codes, classifications):
    with source.open("rb") as sample:
        first_line = sample.readline()
    try:
        first_line.decode("utf-8-sig")
        encoding = "utf-8-sig"
    except UnicodeDecodeError:
        encoding = "cp949"
    with source.open(encoding=encoding, newline="") as stream:
        reader = csv.DictReader(stream, strict=True)
        columns = {}
        for key, prefix in HEADERS.items():
            matches = [name for name in reader.fieldnames or [] if normalize(name) == prefix]
            if key == "status" and not matches:
                matches = [name for name in reader.fieldnames or [] if normalize(name).startswith(prefix)]
            if len(matches) != 1:
                raise ValueError(f"필수 CSV 헤더를 확인하세요: {prefix}")
            columns[key] = matches[0]
        for raw in reader:
            if None in raw or any(value is None for value in raw.values()):
                raise ValueError(f"CSV {reader.line_num}행의 열 개수가 올바르지 않습니다.")
            row = {key: normalize(raw[column]) for key, column in columns.items()}
            province_code = row["province"][:2]
            if province_codes and province_code not in province_codes:
                continue
            try:
                month = re.match(r"^(\d{4})[-./]?(\d{2})(?:[-./]\d{2})?$", row["month"])
                month_date = date(int(month[1]), int(month[2]), 1)
                status = {"1": 1, "2": 2, "등록": 1, "탈퇴": 2}[row["status"]]
                employees = int(row["employees"].replace(",", "")) if row["employees"] else None
                if not row["name"] or (employees is not None and employees < 0):
                    raise ValueError("사업장명 또는 가입자 수")
            except (ValueError, KeyError, TypeError) as error:
                raise ValueError(f"CSV {reader.line_num}행의 기준월, 상태, 이름 또는 가입자 수를 확인하세요.") from error
            address = row["road"] or row["lot"]
            words = address.split()
            region = PROVINCES.get(province_code, words[0] if words else "미분류")
            city = words[1] if len(words) > 1 and words[1].endswith(("시", "군", "구")) else None
            number = re.sub(r"[-\s]", "", row["number"])
            identity = json.dumps([number, row["name"], address], ensure_ascii=False)
            workplace_id = "nps:" + hashlib.sha256(identity.encode()).hexdigest()[:32]
            yield (workplace_id, row["name"], number, status, month_date, row["industry_code"],
                   row["industry"] or "미분류", classifications.get(row["industry_code"]),
                   region, city, address, employees)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--province", action="append", choices=sorted(PROVINCES),
                        help="공개 CSV의 광역시도 코드. 여러 번 지정 가능")
    parser.add_argument("--industry-map", type=Path, help="원본 업종코드 → 검증한 대분류 이름 JSON")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    codes = sorted(set(args.province or []))
    classifications = json.loads(args.industry_map.read_text(encoding="utf-8-sig")) if args.industry_map else {}
    if not isinstance(classifications, dict) or any(not isinstance(value, str) or not value.strip() for value in classifications.values()):
        parser.error("--industry-map은 업종코드를 키로 하는 문자열 JSON 객체여야 합니다.")

    sql_dir = Path(__file__).resolve().parent
    with tempfile.TemporaryFile("w+b") as script:
        output = io.TextIOWrapper(script, encoding="utf-8", newline="")
        try:
            output.write((sql_dir / "pension_stage.sql").read_text(encoding="utf-8"))
            writer = csv.writer(output, lineterminator="\r\n", quoting=csv.QUOTE_ALL)
            month = None
            count = 0
            for row in read_csv(args.csv, codes, classifications):
                if month is not None and row[4] != month:
                    parser.error("한 파일에는 한 기준월만 포함되어야 합니다.")
                month = row[4]
                writer.writerow(row)
                count += 1
            if not count:
                parser.error("가져올 사업장이 없습니다.")
            output.write("\\.\n")
            output.write((sql_dir / "pension_merge.sql").read_text(encoding="utf-8"))
            output.flush()
        finally:
            output.detach()
        print(f"{month:%Y-%m} · {count:,}행 · 지역 {','.join(codes) or '전국'}", flush=True)
        if args.validate_only:
            return
        if not (os.environ.get("PGSERVICE") or os.environ.get("PGHOST")):
            parser.error("관리자 PostgreSQL 연결을 PGSERVICE 또는 PGHOST/PGUSER/PGPASSWORD로 설정하세요.")
        script.seek(0)
        env = {**os.environ, "PGCLIENTENCODING": "UTF8", "PGSSLMODE": os.environ.get("PGSSLMODE", "require")}
        subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-v",
                        f"region_scope={','.join(codes) or 'all'}", "-f", "-"], stdin=script, env=env, check=True)


if __name__ == "__main__":
    main()
