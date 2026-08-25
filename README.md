# 김포–제주 4인 항공권 감시기

2026-09-23 김포(GMP)→제주(CJU, 17:00 이후)와 2026-09-27 제주(CJU)→김포(GMP)를 성인 2명의 **독립된 편도 검색**으로 매시간 확인합니다. 출발편 또는 귀국편 어느 한쪽만 2명 예약 가능해도 해당 구간을 텔레그램으로 알립니다. 유료 API, 로그인, CAPTCHA 우회, 프록시, 탐지 회피는 사용하지 않습니다.

## 중요한 제한

- Google Flights는 좌석 재고 수를 명시하지 않습니다. 따라서 **성인 2명을 승객으로 지정한 각 편도 검색에서 실제 가격이 정상 반환됨**을 예약 가능의 추정 기준으로 사용합니다. `Total price is unavailable`처럼 가격 없는 운항 스케줄은 매진 가능성이 있으므로 알림에서 제외합니다. 결제 직전 반드시 직접 확인하세요.
- 첫 실행의 메시지 폭주를 막기 위해 화면 순서상 최대 10개 왕복 조합을 추적합니다. 추적 대상 조합이 바뀌면 새 조합으로 다시 알립니다.
- 공개 화면의 구조가 바뀌거나 Google이 GitHub Actions IP를 차단/CAPTCHA 처리하면 검색은 실패합니다. 프로그램은 이를 우회하지 않고 `failure.html`과 `failure.png`를 artifact로 남깁니다.
- GitHub Actions 예약 실행은 정각을 보장하지 않으며 부하에 따라 수십 분 이상 늦거나 드물게 누락될 수 있습니다. cron은 혼잡을 조금 피하려고 매시 17분(UTC)에 설정했습니다.
- 무료 GitHub 호스팅 러너의 사용량·정책은 계정과 저장소 유형에 따라 달라질 수 있습니다.
- 2026-09-23 12:00 KST부터는 실행되어도 즉시 정상 종료합니다. 예약 workflow 자체를 삭제하지는 않습니다.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm ci
npx playwright install chromium
npm test
npm run lint
DRY_RUN=1 npm run watch
```

Windows PowerShell에서는 마지막 줄을 `$env:DRY_RUN='1'; npm run watch`로 실행합니다. Secret이 없으면 텔레그램 발송만 안전하게 생략됩니다. 실패 진단은 `artifacts/`에, 중복 방지 상태는 `.state/`에 저장됩니다.

## 비공개 GitHub 저장소 만들기와 업로드

1. GitHub에 로그인하고 오른쪽 위 `+` → **New repository**를 누릅니다.
2. 이름(예: `gmp-cju-flight-watch`)을 입력하고 **Private**을 선택합니다. README 추가는 선택하지 말고 저장소를 만듭니다.
3. 이 폴더에서 아래 명령을 실행합니다. `<사용자명>`은 본인 GitHub 이름으로 바꿉니다.

```bash
git init
git add .
git commit -m "Add flight watcher"
git branch -M main
git remote add origin https://github.com/<사용자명>/gmp-cju-flight-watch.git
git push -u origin main
```

GitHub가 비밀번호를 묻는 경우 계정 비밀번호가 아니라 브라우저 로그인 또는 Personal Access Token을 사용합니다. GitHub Desktop으로 폴더를 추가한 뒤 **Publish repository**에서 `Keep this code private`을 선택해도 됩니다.

## 텔레그램 봇과 Chat ID를 안전하게 준비하기

1. 텔레그램에서 인증 배지가 있는 `@BotFather`와 대화를 열고 `/newbot`을 보냅니다.
2. 안내에 따라 이름과 `bot`으로 끝나는 사용자명을 정합니다. 받은 토큰은 채팅, 코드, 커밋에 붙여 넣지 마세요.
3. 새 봇과의 대화를 열어 **Start**를 누르고 아무 메시지나 하나 보냅니다.
4. 브라우저 주소창에 `https://api.telegram.org/bot<토큰>/getUpdates`를 입력하되 `<토큰>`만 로컬에서 바꿉니다. 반환 JSON의 `message.chat.id` 숫자가 Chat ID입니다. 그룹 알림이면 봇을 그룹에 넣고 그룹에서 메시지를 보낸 후 확인하며, ID는 보통 음수입니다.
5. 확인 후 브라우저 방문 기록에서 토큰이 들어간 URL을 지우는 것을 권장합니다. 토큰이 노출되었다면 BotFather의 `/revoke`로 즉시 교체하세요.

## GitHub Secrets 등록

1. 저장소 페이지의 **Settings** → **Secrets and variables** → **Actions**로 이동합니다.
2. **New repository secret**을 누르고 이름을 `TELEGRAM_BOT_TOKEN`으로 입력한 뒤 BotFather 토큰을 값에 넣어 저장합니다.
3. 같은 방식으로 `TELEGRAM_CHAT_ID`를 만들고 Chat ID를 저장합니다.
4. 값은 workflow 로그에 직접 출력하지 않으며, GitHub도 Secret 값을 마스킹합니다. `.env`는 `.gitignore`에 포함되어 있습니다.

## 첫 실행 확인

1. 저장소의 **Actions** 탭 → **Flight watch** → **Run workflow** → **Run workflow**를 누릅니다.
2. 실행을 열어 각 단계가 녹색인지 확인합니다. 결과가 없으면 메시지 없이 로그에 개수만 남는 것이 정상입니다.
3. 실패하면 실행 페이지 아래 **Artifacts**에서 `flight-watch-diagnostics-*`를 내려받아 화면 변경, CAPTCHA, 차단 여부를 확인합니다. HTML에는 검색 화면만 저장하며 Secret을 삽입하지 않습니다.
4. 동일 조합은 Actions 캐시의 `.state/flight-watch.json`에 기록되어 반복 알림하지 않습니다. 결과가 한 번 사라져 활성 목록에서 빠진 뒤 다시 나타나면 재알림합니다.
5. 연속 오류 3회째에 점검 알림을 한 번 보내고, 정상 검색이 한 번 성공하면 오류 상태가 초기화됩니다.

## 대체 경로에 관하여

무료·로그인 없는 다른 항공 검색 사이트도 대부분 이용약관, 봇 차단, 화면 변경이라는 같은 제약이 있습니다. 현재 구현은 Google Flights 한 곳을 명시적으로 사용해 유지보수 범위를 줄였습니다. Google이 호스팅 러너를 지속 차단하면 artifact와 로그로 원인을 확인한 뒤, 해당 사이트의 약관이 자동 조회를 허용하는 공개 검색 화면 어댑터를 별도로 추가해야 합니다. CAPTCHA 우회나 차단 회피는 이 프로젝트 범위에 포함하지 않습니다.
