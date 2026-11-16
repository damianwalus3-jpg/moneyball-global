# MONEYBALL GLOBAL MAIN — optymalizacja synchronizacji wyników ESPN
Data: 2026-11-16 (Europe/Brussels)

## Zakres
- Wyłącznie istniejące repozytorium `damianwalus3-jpg/moneyball-global`, gałąź `main`.
- Istniejący frontend Cloudflare Worker `moneyball-global` i istniejący projekt Supabase `gzgeklcukrclgwbsmbsp`.
- Nie zmieniano bazy, historii meczów, prognoz, kuponów ani transakcji bankrolla.

## Diagnoza
- `moneyball-results-sync` odpytuje źródła zapasowe na podstawie nierozstrzygniętych, już rozpoczętych meczów z badanego dnia.
- ESPN miał stałą listę 22 lig, niezależnie od tego, czy dana liga miała mecz wymagający wyniku.
- Dodatkowo pobierano katalog lig ESPN, a następnie dopisywano kolejne ligi. To rozszerzało liczbę żądań poza potrzebne mecze.
- Produkcyjne wywołania wersji 65 przed poprawką: 6.975–16.367 s w zbadanym oknie; ostatnie przed wdrożeniem: 13.062 s. Samo HTTP 200 nie potwierdza rozliczenia kuponu.

## Zmiana
- Dodano `supabase/functions/moneyball-results-sync/espn-leagues.ts` z deterministycznym wyborem lig ESPN na podstawie rzeczywistych, zaległych meczów europejskich.
- Usunięto globalne pobieranie katalogu lig ESPN i stałe odpytanie całej listy 22 lig.
- Rozpoznawane są oddzielnie ligi krajowe, wybrane drugie poziomy, rozgrywki kobiece oraz UEFA (w tym Nations League, Champions League i UEFA U21 qualifiers).
- Jeżeli nie ma pasującego meczu, ESPN nie jest odpytywany.
- Zachowano pozostałe źródła zapasowe: TheSportsDB, OpenMatchday i OpenLigaDB; nie zmieniono dopasowania wyników ani reguł blokowania rozbieżnych wyników.
- Dodano log pomiarowy ESPN: liczba zaległych meczów, wybrane ligi, liczba udanych zapytań, liczba eventów, błędy i czas etapu.

## Bieżący zestaw zaległych meczów
Odczyt bazy dla 2026-11-16 wykazał:
- UEFA Nations League — 3 mecze
- UEFA U21 Championship - Qualification — 1 mecz
- Frauen Bundesliga (Niemcy) — 1 mecz
- 2. liga (Słowacja) — 1 mecz

Dla tych rekordów selektor ESPN wybiera tylko `uefa.nations` i `uefa.euro_u21_qual`; nie odpytuje niezwiązanych lig angielskich, hiszpańskich, włoskich itd. Niemiecka liga kobieca i słowacka 2. liga nadal mogą być obsłużone przez pozostałe źródła zapasowe.

## Testy i wdrożenie
- Dodano testy selektora dla braku zaległych meczów, kraju, drugiego poziomu, rozgrywek kobiecych, UEFA U21, Nations League i deduplikacji.
- GitHub commit: `6843844b9690f0a9963ac7eb00b418e00c6e1b1b`.
- Moneyball CI run #773: SUCCESS — Deno Edge Function check, Vitest, TypeScript i build.
- Cloudflare Workers deploy run #376: SUCCESS.
- Supabase Edge Function `moneyball-results-sync`: wersja 66, ACTIVE, `verify_jwt=false` (zachowano istniejącą wewnętrzną autoryzację cron/token i użytkownika).
- SHA wdrożonej funkcji: `112477b48111d3c042bf822933d37905133a8b84f928118793d9535ead8d9c0f`.
- Cron `moneyball-results-sync-every-10m` pozostaje aktywny co 5 minut.

## Co pozostaje do potwierdzenia
1. Pierwsze wykonanie crona na wersji 66 musi zapisać log `[moneyball-results-sync] ESPN selection` z wybranymi ligami i rzeczywistym czasem.
2. Porównać czas całego żądania z baseline wersji 65; nie deklarować poprawy procentowej przed pomiarem.
3. Zachować i obserwować liczbę wyników dopasowanych przez źródła alternatywne — nie wolno traktować braku eventu ESPN jako powodu do pominięcia meczu.
4. Pełne E2E rozliczenia kuponu nadal nie jest zaliczone: wymagany rzeczywisty FT meczu z kuponu 4 EUR, automatyczna zmiana statusu nogi i kuponu oraz dokładnie jeden zwrot w ledgerze. Ponowny cykl musi pozostawić saldo bez zmian.
5. Nie wykonywać fikcyjnych wyników ani nie zmieniać ręcznie prawdziwych statusów nóg w celu zaliczenia testu.


## Wersja 68 — optymalizacja zapisu i rozliczania (16.11.2026)
- Dodano `dbUpsert` z PostgREST `on_conflict` i `resolution=merge-duplicates`; zapis obserwacji źródeł nie wykonuje już SELECT+PATCH/POST dla każdego wiersza.
- Obserwacje alternatywnych źródeł są grupowane i zapisywane jednym UPSERT-em; awaryjnie wykonywane są ograniczone równoległe pojedyncze UPSERT-y.
- Rozliczenie predykcji grupuje aktualizacje statusów won/lost; nogi kuponów pobierane są jednym zapytaniem dla rozliczanych predykcji, a następnie aktualizowane grupowo.
- Nadal osobno aktualizowane są finansowe pola wybranych predykcji i wykonywane jest uzgodnienie finansowe kuponu.
- CI run #779: SUCCESS (Deno typecheck, Vitest, TypeScript, build).
- Cloudflare Workers deploy run #382: SUCCESS.
- Supabase Edge Function `moneyball-results-sync`: wersja 68 ACTIVE.
- Pierwszy pomiar wersji 68 (17:35:04 UTC): HTTP 200, 4.757 s, 79 fixtures z FootyNomad, 7 zaległych spotkań do ESPN, 2 ligi ESPN, 11 eventów ESPN, 14 obserwacji alternatywnych, 13 dopasowanych, 2 wyniki zapisane, 26 predykcji rozliczonych, 0 błędów. ESPN 264 ms; alternatywne źródła 880 ms; odczyt meczów 244 ms; uzgodnienie finansowe 75 ms.
- Porównanie pojedynczych wykonań: wersja 67 = 16.089 s, wersja 68 = 4.757 s (spadek ok. 70.4%). To pierwszy pomiar wersji 68, wymaga potwierdzenia na kilku kolejnych cyklach; nie jest gwarancją stałego czasu.
- Uwaga: w tym przebiegu `couponLegsSettled=0`. 26 predykcji zostało rozliczonych, ale nie było powiązanych nóg kuponów do aktualizacji dla tych meczów. Nie oznacza to zaliczenia testu pełnego rozliczenia kuponu.
- Następny krok: zweryfikować, czy wybrane predykcje kuponów mają poprawne relacje `coupon_legs.prediction_id`, oraz wykonać kontrolowany test idempotencji na rzeczywistym kuponie testowym bez modyfikowania historycznych wyników.
