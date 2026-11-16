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


## Kontynuacja audytu 2026-11-16 — wydajność i kursy
- Commit `db7f8f3cda431d80b82e70d51fc5f9bf804cdf8f`: poprawiono typowanie polityk odświeżania tabel w `src/lib/queries.ts` przez `Partial<Record<TableName, TableRefreshPolicy>>`.
- GitHub Actions CI run #717 / ID `43897983300`: SUCCESS; Deno check, testy, TypeScript i build — wszystkie kroki SUCCESS.
- Cloudflare deploy run #320 / ID `43897983286`: SUCCESS; build Cloudflare Workers i deploy — SUCCESS.
- Polityki zapytań: matches 15 min, match_results 5 min, coupons i coupon_legs 60 s; summary RPC zachowuje osobny interwał LIVE.
- Ponowny audyt `provider_odds` w 2026-11-16: 219022 rekordów, 0 niesuspendowanych rekordów z ostatnich 6 godzin; max(captured_at) = 2026-11-16 02:11:13 UTC. Nie używać starych kursów jako aktualnych.
- Logi `moneyball-movi-odds-sync`: POST 500 powtarzał się w wersji 5 (03:11–08:45 UTC); wcześniejsze POST 200 trwały ok. 12–16 s, a pojedynczy błąd trwał do ok. 59 s. GET healthcheck wersja 6 odpowiada 200, ale nie potwierdza poprawności POST synchronizacji.
- Kod synchronizacji nadal pobiera mecze dnia bez filtra ligi/gender przed dopasowaniem i odpytuje snapshoty w grupach po 12 równoległych żądań. To potwierdzony zakres do poprawy; nie wdrożono jeszcze zmiany, ponieważ filtr musi użyć tej samej funkcji zakresu ligi co dashboard, aby nie odciąć poprawnych meczów.
- Brak potwierdzonego testu zalogowanego panelu i end-to-end kupon -> wynik -> rozliczenie -> saldo.


## Rozstrzygnięcie źródła kursów — audyt 2026-11-16 (16:xx Europe/Brussels)
- Potwierdzono publicznym GET funkcji `moneyball-movi-odds-sync`: `key_configured=false`. Żaden sekret `MOVIODDS_API_KEY` nie jest skonfigurowany w środowisku funkcji.
- Test sieciowy wykonany z produkcyjnej bazy przez `net.http_get` do `https://moviodds.com/catalog?sport=soccer` zwrócił HTTP 401, treść: `API key required`. To jest bezpośrednia przyczyna braku nowych danych z MoviOdds bez klucza; endpoint nie jest obecnie dostępny anonimowo z naszego środowiska.
- Dokumentacja dostawcy opisuje darmowy klucz konta i limity bezpłatne; ale wymaga rejestracji/klucza w aktualnym teście. Nie dodawać klucza do kodu ani frontendu. Użytkownik wcześniej wykluczył klucze API, więc nie tworzyć ani nie prosić o płatny klucz.
- Harmonogram pg_cron zadanie #10 (MoviOdds, co 15 min) ma `active=false`. W historii ostatnie wpisy `cron.job_run_details` mówią `succeeded / 1 row`, ale oznacza to tylko poprawne zakolejkowanie `net.http_post`, a nie sukces Edge Function. Równoległe logi Edge Function pokazują POST 500 w wersji 5. Nie przywracać cron, dopóki endpoint nie przejdzie testu POST i nie będzie źródła autoryzacji.
- Audyt bazy: 34 mecze dziś, z czego 12 przeszło dokładny SQL-owy filtr mężczyzn i europejskich lig top-two. Synchronizacja obecnie pobiera wszystkie 34 i nie korzysta z `moneyball_is_european_top_two_league` ani filtra `gender`.
- Test alternatywy Bwin Sports API: oficjalna dokumentacja potwierdza endpointy fixture/odds, ale strona API opisuje dostęp jako partnerski i wymagający rejestracji/akceptacji; test żądania z produkcyjnego środowiska do `sportsapi.bwin.com/offer/api/4/be/fixtures` zwrócił HTTP 403 HTML. Nie uznawać tego za gotowe darmowe źródło.
- Zewnętrzny research MoviOdds: docs mówią o bezpłatnym kluczu konta i bezpłatnych limitach, lecz realny test produkcyjny bez klucza daje 401. Źródła: https://moviodds.com/doc ; https://moviodds.com/docs/betbuilder/ . Bwin partner API docs: https://sportsapi.bwin.com/offer/swagger/index.html ; opis dostępu partnerskiego: https://sportsapi.bwin.com/ .
- Najbezpieczniejsza decyzja przy obecnych ograniczeniach (bez API keys/płatnych usług): nie udawać aktualnych kursów, nie wykorzystywać starych zapisów, nie włączać cron; utrzymać kupony TEST wyłącznie do oceny skuteczności modelu, a MAIN/MEGA/EXTRA blokować do czasu zapewnienia autoryzowanego źródła kursów. Jeśli użytkownik zezwoli na darmowy klucz MoviOdds, to jest najmniej inwazyjna droga; alternatywnie wymagana jest zgoda/partner access Bwin. Publiczne fair-odds feeds nie są kursem bukmachera i nie mogą zastępować ceny do rozliczeń.
- Następny krok techniczny po uzyskaniu źródła: RPC SQL używający wspólnej funkcji zakresu ligi, filtr `gender='men'`, pobieranie tylko dzisiejszych eligible fixtures; ograniczenie snapshot concurrency do 3–4; retry 429/5xx z Retry-After i exponential backoff+jitter; obsługa `polled_at` / `group_status` jako świeżości (nie `ts`); dziennik per-fixture status/error; idempotentny upsert; włączenie cron dopiero po teście POST z zapisem świeżych kursów.
