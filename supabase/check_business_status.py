"""Look up known business registration numbers using the NTS status API."""

import argparse
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("business_numbers", nargs="+")
    args = parser.parse_args()
    numbers = list(dict.fromkeys(re.sub(r"[-\s]", "", number) for number in args.business_numbers))
    if len(numbers) > 100 or any(not re.fullmatch(r"[0-9]{10}", number) for number in numbers):
        parser.error("가려지지 않은 10자리 사업자등록번호를 한 번에 최대 100개 입력하세요.")
    key = os.environ.get("NTS_SERVICE_KEY")
    if not key:
        parser.error("공공데이터포털에서 받은 디코딩 인증키를 NTS_SERVICE_KEY로 설정하세요.")
    query = urlencode({"serviceKey": key, "returnType": "JSON"})
    request = Request(
        "https://api.odcloud.kr/api/nts-businessman/v1/status?" + query,
        data=json.dumps({"b_no": numbers}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            result = json.load(response)
    except HTTPError as error:
        parser.exit(1, f"국세청 상태 조회 실패 (HTTP {error.code})\n")
    except (URLError, TimeoutError, ValueError):
        parser.exit(1, "국세청 상태 조회 응답을 확인하지 못했습니다.\n")
    if not isinstance(result, dict) or result.get("status_code") != "OK" or not isinstance(result.get("data"), list):
        parser.exit(1, "국세청 API에서 정상 상태 조회 결과를 받지 못했습니다.\n")
    print(json.dumps(result["data"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
