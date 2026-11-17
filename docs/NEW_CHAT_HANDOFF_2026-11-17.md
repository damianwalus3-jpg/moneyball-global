# MONEYBALL REBUILD — przekazanie do nowego czatu
**Ostatnia aktualizacja:** 2026-11-17  
**Projekt aktywny:** MONEYBALL REBUILD / MONEYBALL — TRUST THE PROCESS.

## Najważniejsze: nie pomyl środowisk
- Repo: `damianwalus3-jpg/moneyball-global`
- Branch: `moneyball-rebuild`
- Produkcyjny Worker: https://moneyball-global-rebuild.damianwalus3.workers.dev/
- Pracuj WYŁĄCZNIE na powyższym branchu i Workerze.
- NIE modyfikuj `main`, Worker MAIN, Vercel, TEST ani Lovable.
- Nie używaj płatnych usług ani nie dodawaj API keys bez zgody.
- Trwały dziennik: `docs/REBUILD_EXECUTION_LOG.md`.
- Raport kursów: `docs/ODDS_PROVIDER_RESEARCH_2026-11-17.md`.

## Cel użytkownika
Użytkownik chce, aby aplikacja automatycznie pobierała kursy meczów, najlepiej dla wszystkich europejskich rozgrywek, i zapisywała ich historię. Chce także statystyki typów wybranych i odrzuconych, stawki oraz zyski/straty. Należy wyraźnie odróżniać wyniki rzeczywiste od papierowych/symulowanych.

## Stan aplikacji i ograniczenia
- React + TypeScript + Vite + PWA.
- Zakładki: Dashboard, Mecze, Typ dnia, Kupony, Intelligence, Stawki, Tracker.
- Tracker jest w localStorage tego samego urządzenia/przeglądarki; JSON backup/import i CSV export. Brak synchronizacji między urządzeniami i kont.
- Brak podłączonego dostawcy kursów. Tracker ma już `odds` kind, ale to nie jest feed.
- Kursy w Stawkach były dotychczas wprowadzane ręcznie.
- Brak rzeczywistego stawiania zakładów; kupony są papierowe/testowe.
- Europejski feed meczów: open-matchday, OpenLigaDB, OpenFootball; nie gwarantuje 100% wszystkich rozgrywek.
- Aktualizacja meczów/wyników działa przy starcie i cyklicznie, gdy aplikacja jest otwarta; nie działa jako pełny background task po zamknięciu aplikacji.
- Model jest prostym Poissonem opartym o ostatnie gole i podział home/away; nie jest modelem xG ani nie uwzględnia składów/kontuzji. Double Chance jest pochodną 1X2.
- Kursy/EV nie mogą być wymyślane; brak kursu ma być jawny.
- Automatyczne rozliczanie wybranych/odrzuconych rekordów bazuje na zweryfikowanych wynikach; rejected ma wynik hipotetyczny, ale nigdy nie zmienia P/L.

## Wykonane etapy
Etapy 01–48 zostały opisane w `docs/REBUILD_EXECUTION_LOG.md`. Wśród nich:
- fundament PWA i skan europejskich źródeł,
- forma pięciu meczów i transparentny model bramkowy Poisson,
- analiza zbiorcza, kupony papierowe 3 mecze,
- audyt modelu i kalibracja,
- automatyczne odświeżanie/rozliczanie wyników,
- eksport Tracker JSON/CSV,
- wyjaśnianie odrzuceń i wybór jednego najlepszego kandydata,
- rejestr wybranych/odrzuconych kursów i stawek z automatycznym rozliczeniem P/L.
Wcześniej odnotowany sukces etapu 48: CI, Rebuild Checks i Cloudflare Deploy przechodziły na ówczesnym HEAD; przed kolejnymi zmianami zawsze odczytaj aktualny HEAD i statusy workflow.

## Najnowsze badanie kursów — wniosek
Nie znaleziono potwierdzonego źródła jednocześnie: szerokie europejskie pokrycie + darmowe + stabilne + bez API key.
- API-Football Free: 100 requestów/dzień, pre-match i live odds, klucz wymagany; pre-match aktualizacja ok. 3h, 1–14 dni przed meczem, 7-dniowa historia; coverage zależy od fixture/league/bookmaker.
- APIfootball.com Free: 180 req/h/endpoint, 65+ bookmakers, ale darmowe rozgrywki tylko Championship i Ligue 2; klucz wymagany.
- The Odds API: 500 kredytów/miesiąc, klucz; ograniczone do wybranych pobrań.
- Odds-API.io: nowe darmowe klucze zawieszone.
- Sportmonks Free: tylko Danish Superliga + Scottish Premiership; odds add-on płatny.
- football-data.org: odds add-on płatny.
- Betfair: delayed API key możliwy dla developmentu, live i licencje odrębne.
- OddsPortal GitHub scraper jest do historycznych kursów, nie potwierdza legalnego/stabilnego live feed.
Szczegóły, linki i architektura w `docs/ODDS_PROVIDER_RESEARCH_2026-11-17.md`.

## Rekomendowana następna praca
1. Potwierdź aktualny branch HEAD i workflow statusy, zanim cokolwiek edytujesz.
2. Zaprojektuj provider-neutral adapter odds i schemat append-only snapshotów; dopasowanie kursów do fixture musi być konserwatywne.
3. Wykorzystaj Cloudflare Worker jako jedyne miejsce pobierania danych i przechowywania sekretów; nigdy nie ujawniaj klucza w React, repo, logach ani publicznym endpoint.
4. Przygotuj bezpieczny pilot API-Football Free, ale NIE wymagaj klucza ani nie wdrażaj do produkcji bez zgody użytkownika. Jeśli użytkownik odmawia klucza, pokaż uczciwie, że zero-key feed nie został potwierdzony.
5. Po dostępie do klucza wykonaj live test na kilku ligach, zmierz coverage i limity requestów; dopiero potem zaplanuj harmonogram odświeżania.
6. Dodaj kursy do Stawki/Kuponów oraz statystyki selected vs rejected, P/L, ROI, hit rate, podział po rynku/ligi/zakresie kursów.
7. Zaktualizuj ten handoff i dziennik po każdym etapie; commit i CI/deploy potwierdzaj konkretnymi SHA i run IDs.

## Zasada uczciwości
Nie deklaruj, że wszystkie mecze Europy mają kursy. Nie przedstawiaj opóźnionych kursów jako live. Nie podstawiaj kursów z podobnego meczu. Nie nazywaj papierowego P/L rzeczywistym wynikiem finansowym. Nie usuwaj historii użytkownika.

## Uzupełnienie badań kursów po rozszerzonym przeszukaniu internetu
Nowe najlepsze opcje do testu:
- **OddsPapi Free**: 250 requests/month, pre-game REST, history, szeroka lista bookmakerów wg dostawcy; klucz wymagany, nie ma darmowego WebSocket, dostawca nie gwarantuje kursu dla każdego meczu. Dane o 300+ books są deklaracją vendora; testować rzeczywiste ligi i fixture.
- **StrikerAPI Free**: 500 credits/month; get_odds: 5 credits per match lub 10 credits per day; odświeżenie co godzinę dla nadchodzących 4 dni, brak live; wybrane europejskie ligi, nie pełna Europa.
- **Polymarket Gamma API**: keyless public API, ale prediction-market prices, nie kursy bookmakerów; używać wyłącznie osobno jako benchmark tam, gdzie istnieje płynny rynek.
- **FootballAPIs.com**: katalog 17 providerów i MCP discovery, nie feed odds.
- **OddsHarvester**: open-source scraper OddsPortal, ale OddsPortal ToS zakazuje automatycznych żądań/scrapingu/agregacji bez zgody; nie wdrażać bez pisemnej zgody.
- **BetExplorer**: ToS także zakazuje scraping/automatycznych żądań bez zgody.
- **football-data.co.uk**: ma historyczne i sezonowe CSV z kursami, ale zastrzega prywatny użytek, nie komercyjne produkty, boty/scraping/AI training; nie wdrażać bez zgody.
Fora Reddit r/algobetting zgłaszają blokady Cloudflare, zmiany HTML/XHR, regionalne różnice kursów i bookmakerów oraz utrzymaniowy koszt scraperów. Nie obchodzić blokad przez rotację proxy/VPN.
Szczegóły, linki i tabela są w `docs/ODDS_PROVIDER_RESEARCH_2026-11-17.md`.
**Kolejny krok:** test pilotażowy OddsPapi i StrikerAPI, ale tylko po zgodzie użytkownika na darmowy klucz API. Bez klucza nie ma obecnie potwierdzonego legalnego, stabilnego feedu sportsbook odds o szerokim europejskim pokryciu.


## Zmiana decyzji użytkownika — darmowy pilot OddsPapi + StrikerAPI (2026-11-17)
Użytkownik zaakceptował oba darmowe klucze. Przygotowano plan: `docs/ODDS_PROVIDER_PILOT_TEST_2026-11-17.md`; Stage 51 zapisany w `docs/REBUILD_EXECUTION_LOG.md`.
- OddsPapi: `ODDSPAPI_API_KEY`, Worker Secret; Free 250 requests/month; plan pilota używa maks. 5–8 fixture odds calls plus minimalne discovery.
- StrikerAPI: `STRIKERAPI_API_KEY`, Worker Secret; Free 500 credits/month; get_odds 10 credits/day lub 5/match.
- Live testing is BLOCKED until the user creates free accounts/keys and sets both secrets directly in Cloudflare dashboard for Worker `moneyball-global-rebuild`. Never ask for keys in chat and never commit them.
- No provider code integration or production odds storage has been deployed yet. Do not count pilot samples as real bets/P&L.
- After secrets exist, run small sample across available European leagues, report fixture match coverage, complete 1X2 coverage, bookmaker names (especially Belgian-relevant books), timestamps/freshness, API errors and quota cost. Never infer complete Europe coverage.


## Stage 52 — Worker proxy dla pilota kursów
- Dodano `GET /api/odds/status`: pokazuje tylko flagi konfiguracyjne dla OddsPapi/StrikerAPI, nigdy wartości sekretów.
- Dodano `GET /api/odds/pilot?fixtureId=PROVIDER_ODDSPAPI_ID&strikerGameId=PROVIDER_STRIKER_ID`; można podać jeden lub oba identyfikatory. Endpoint wykonuje tylko wskazane zapytania, nie skanuje automatycznie meczów.
- OddsPapi: `GET https://api.oddspapi.io/v4/odds`; StrikerAPI: `POST https://mcp.strikerapi.com/v1/get_odds`. Kursy StrikerAPI moneyline są normalizowane do decimal dla home/draw/away.
- Sekrety Worker: `ODDSPAPI_API_KEY`, `STRIKERAPI_API_KEY`. Ich obecność należy sprawdzić po wdrożeniu przez `/api/odds/status`; nie mamy bezpośredniego odczytu Cloudflare Secret Store.
- Testy dodane w `src/worker.test.ts`. Commity kodu: `a6cd74c18d20a63b1c9ed6b2f81edd096fd20270`, testy: `acc8dd051946c6d23967dea6aa388905034740bf`; dziennik Stage 52: `f9f5e0cfbe4df2141acf3c2a40e2a80d904decbb`.
- CI run `44187285622` wystartował dla commita Worker; status końcowy i deploy wymagają ponownego sprawdzenia. Pilot live, fixture matching, snapshot storage i UI odds pozostają NIEZREALIZOWANE.
- Ważne: StrikerAPI wymaga własnego `game_id`; nie podawać lokalnego ID Moneyball, chyba że potwierdzono mapowanie.
