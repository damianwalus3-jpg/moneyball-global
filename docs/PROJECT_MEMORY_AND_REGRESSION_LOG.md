# MONEYBALL GLOBAL — trwałe zasady i rejestr poprawek
Ostatnia aktualizacja: 2026-11-16 (Europe/Brussels)

Ten plik jest trwałym punktem kontrolnym projektu. Przed każdą zmianą należy go przeczytać i rozszerzać po każdym potwierdzonym błędzie lub wdrożeniu. Nie odtwarzać rozwiązań z pamięci rozmowy, jeżeli aktualny kod/baza mówią inaczej.

## Nienaruszalne wymagania użytkownika
- Produkcja wyłącznie Cloudflare Workers. Nie wdrażać ani nie przywracać Vercel.
- Nie wprowadzać Lovable, dodatkowych aplikacji ani płatnych API/kluczy bez wyraźnej zgody.
- Wirtualne kupony, bez obstawiania prawdziwych pieniędzy.
- Nowe kupony: stawka 4 EUR za kupon; nie przepisywać historycznych stawek w ledgerze.
- Skan tylko dzisiejszych meczów wg Europe/Brussels.
- Europa, krajowe ligi mężczyzn, pierwsza i druga klasa rozgrywkowa; wykluczyć puchary, rozgrywki młodzieżowe, kobiece, rezerwy i niższe ligi.
- Oficjalne typy 1/X/2, osobno Double Chance i gole; wszystkie mecze mają mieć zapisany typ lub status odrzucony. Kupony: dokładnie 3 różne mecze, każdy >75%, bez powtórzeń meczów między kuponami partii.
- MAIN/MEGA/EXTRA tylko z aktualnymi, potwierdzonymi kursami. TEST może służyć ocenie modelu, ale nie wolno przedstawiać starych kursów jako aktualnych.
- Nie wznawiać starego cron prediction bez audytu idempotencji, paginacji i nakładania zadań.

## Trwałe poprawki 2026-11-16
1. Commit `625f32676210e31eb6b7555fc639a593eb1b9731` — `src/lib/domain.ts`: wykluczenie nazw lig kobiecych (women/woman/female/frauen/damen/feminine/femminile/femenina/ladies/girls) oraz odrzucanie meczu, gdy `gender` jest ustawione i nie jest `men`.
2. Commit `1bed4087e872921d49c746b191e29df766bec158` — testy regresyjne dla Frauen Bundesliga, Serie A Femminile oraz `gender=women`.
3. Migracja bazy `exclude_womens_leagues_from_european_scope`: rozszerzenie `moneyball_is_european_top_two_league` o wzorce lig kobiecych.
4. Migracja bazy `exclude_non_mens_fixtures_from_dashboard`: filtry `coalesce(m.gender,'men')='men'` w `moneyball_dashboard_summary` i `moneyball_dashboard_selected_picks`.
5. Testy SQL potwierdziły: Bundesliga, 2. Bundesliga, Premier League, Serie A i Greece Super League 2 dozwolone; Frauen Bundesliga, Serie A Femminile, Serie C, Premier League Cup i UEFA Nations League odrzucone.

## Weryfikacja CI i Cloudflare
- Commit kodu/testów: `1bed4087e872921d49c746b191e29df766bec158`.
- GitHub Actions Cloudflare deploy run #315, ID `43895768389`: SUCCESS.
- Kroki: install dependencies, Deno check Edge Functions, tests, TypeScript check, Cloudflare build i deploy — wszystkie SUCCESS.
- Produkcyjny adres: https://moneyball-global.damianwalus3.workers.dev/
- Sam sukces CI/deploy nie zastępuje testu zalogowanego panelu i end-to-end settlement.

## Otwarte problemy — NIE UZNAWAĆ ZA NAPRAWIONE
1. Kursy: audyt 2026-11-16 wykazał 0 świeżych, niesuspendowanych kursów w ostatnich 6h; ostatni zapis ok. 02:11 UTC. Wstrzymać MAIN/MEGA/EXTRA do czasu uzyskania aktualnych kursów.
2. Wydajność Edge Functions (ostatnie 24h):
   - moneyball-predict: 248 wywołań, średnio 8.6 s, p95 21.7 s, max 95.1 s, 7 błędów 5xx.
   - moneyball-results-sync: 148 wywołań, średnio 11.2 s, p95 24.5 s, max 147.8 s, 4 błędy 5xx.
   - moneyball-free-feed: 81 wywołań, średnio 3.0 s, p95 6.8 s, bez 5xx.
   - moneyball-movi-odds-sync: 31 wywołań, średnio 21.4 s, p95 72.8 s, max 107.3 s, 11 błędów 5xx.
3. Widoki nadal mogą pobierać duże tabele; przejść na filtrowane RPC/paginację i lazy loading.
4. Zalogowany test kliknięcia skanowania oraz pełny test kupon->wyniki->saldo nie są jeszcze potwierdzone.

## Procedura przed każdym wdrożeniem
1. Przeczytać ten dokument i sprawdzić aktualny `main`.
2. Zmienić minimalny, jasno określony zakres; dodać test regresyjny dla znalezionego błędu.
3. Uruchomić CI: testy, Deno check, TypeScript, build i Cloudflare deploy.
4. Sprawdzić wynik workflow; nie ogłaszać wdrożenia przed SUCCESS.
5. Wykonać test produkcyjnego URL oraz, gdy wymaga logowania, wyraźnie oznaczyć brak testu panelu zamiast zgadywać.
6. Po poprawce dopisać datę, commit, migrację, test i pozostałe ryzyka do tego pliku.



## Wcześniejsza historia prac
Szczegółowe wpisy historyczne pozostają w poprzedniej wersji dokumentu i są zachowane w repozytoryjnej historii Git. Ten wpis dopisuje najnowszy audyt po wdrożeniu Edge Function v65.

### 2026-11-16 — kontrola automatycznego rozliczania po wdrożeniu v65
- Ponownie odczytano produkcyjne `coupon_legs`, `coupons`, `predictions`, `matches` i `match_results` dla wszystkich nóg pending.
- Stan w chwili kontroli: 6/6 nóg nadal pending, oba kupony TEST po 4.00 EUR nadal pending. Nie znaleziono wyniku końcowego (home_score/away_score null, verified/source null) dla tych spotkań.
- Lista: Faroe Islands–Moldova (status meczu live; bez potwierdzonego FT), Iceland–Luxembourg i Lithuania–Liechtenstein (kickoff 17:00 UTC, scheduled w chwili zapytania), Switzerland–Scotland, Greece–Serbia i Gibraltar–Malta (kickoff 19:45 UTC, scheduled w chwili zapytania). Zatem brak rozliczenia był zgodny z potwierdzonym stanem spotkań — nie jest dowodem awarii.
- Cron job #2 results-sync: ostatnie 10 wykonań w `cron.job_run_details` (16:30–17:15 UTC) miało status succeeded. Najnowszy request pg_net / Edge Function o 17:15:00 UTC zwrócił HTTP 200, JSON `ok=true`, 79 fixtures fetched, 10 matches matched (8 external ID, 2 team names), 2 results saved, 26 predictions settled, 0 coupon legs settled, 0 errors; finansowe reconciliation 5 checked / 0 failed.
- Ważne ograniczenie czasu: odpowiedź Edge Function z 17:15:00 UTC miała `x-envoy-upstream-service-time=14593 ms` (ok. 14.6 s). Cron wpis `succeeded` oznacza prawidłowe zakolejkowanie żądania pg_net; nie jest miarą czasu ani samodzielnym potwierdzeniem wyniku funkcji. W odpowiedzi HTTP 200 funkcja zakończyła się poprawnie, ale opóźnienie upstream jest nadal istotnym problemem wydajności do profilowania.
- Dodatkowe cykle o 17:12–17:15 dla joba predykcji zwracały HTTP 200 `skipped=true, reason=cooldown`; to oczekiwane działanie blokady po pełnym skanie, a nie awaria.
- Nie zmieniono żadnego wyniku, statusu nogi, kuponu ani salda. Ostatnie potwierdzone saldo ledgeru pozostaje 73.85 EUR; bez rozliczenia nowych kuponów.
- Następny test: po rzeczywistym FT źródło musi zapisać zweryfikowany wynik, rozliczyć prediction i coupon_leg, zmienić status kuponu, a RPC ma dopisać zwrot dokładnie raz. Powtórny cron/RPC musi pozostawić identyczny payout i saldo. Dopiero wtedy oznaczyć E2E jako zaliczony.
- Dalsza naprawa do wykonania: profilowanie `moneyball-results-sync` (zwłaszcza pobieranie 79 fixtures i 23 alternatywnych wyników oraz dopasowanie 10 spotkań) i pomiar czasu każdego etapu. Nie ograniczać zakresu wyników bez testu pokrycia, by nie pogorszyć rozliczeń.
