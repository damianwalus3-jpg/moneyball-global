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
