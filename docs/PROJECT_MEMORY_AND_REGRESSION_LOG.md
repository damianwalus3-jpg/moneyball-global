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


## Naprawa skanu produkcyjnego — 2026-11-16 (16:xx Europe/Brussels)
- Potwierdzono produkcyjny Cloudflare Worker URL: HTTP/HTTPS response 200, strona MONEYBALL GLOBAL 2.0, czas odpowiedzi ok. 920 ms.
- Wdrożenie GitHub Actions CI #717 i Cloudflare #320: SUCCESS (wcześniej zapisane wyżej).
- Bezpośredni audyt Edge Function `moneyball-predict` ujawnił, że `fixtureGender` rozpoznawał kobiece/rezerwowe rozgrywki, ale filtr listy meczów nie wymagał `fixtureGender(m)==='men'`. Wdrożono wersję 211 z filtrem mężczyzn.
- Dalszy test wykazał brak aliasów ukraińskiej drugiej ligi `Persha Liga` i `Druha Liga` w JS-owej allowliście funkcji (mimo że filtr SQL dashboardu je dopuszczał). Wdrożono wersję 212 z tymi aliasami.
- Źródło repo zsynchronizowano w `supabase/functions/moneyball-predict/index.ts`, commit `956fc9fc159423bbcbb4ba62256ed542bca6d55e`.
- Wykonano produkcyjny skan dzisiejszej daty Europe/Brussels 2026-11-16 w czterech partiach offset 0/10/20/30, każda odpowiedź HTTP 200. Po poprawkach ponowiono wszystkie cztery partie. Operacja jest idempotentna przez unikalny klucz owner/match/model/market/selection i aktualizację istniejących pending; nie powstały duplikaty.
- Weryfikacja DB po skanie: 12/12 meczów z bieżącego zakresu SQL (mężczyźni, Europa, pierwsza/druga liga) ma prognozy MONEYBALL GLOBAL 3.8; 0 brakujących; 141 wierszy prognoz; 139 verdict=ODRZUCONY, 0 WYBRANY. Pozostałe 2 wiersze mają inne statusy. Brak WYBRANY oznacza, że obecne kryteria/data coverage nie uzasadniają kandydatów >75%; nie tworzyć kuponów MAIN/MEGA z wymuszonych typów.
- Endpoint skanu nadal nie tworzy kuponów automatycznie (jawne w odpowiedzi: couponCreated=false). Generator kuponów pozostaje osobną czynnością użytkownika. Nie uruchomiono automatycznego kuponowania.
- Automatyczny job #11 nadal `active=false`. Nie włączono go: harmonogram wylicza offset wyłącznie z minut od 08:00, więc nie jest bezpiecznym cyklicznym skanerem na cały dzień i nie ma potwierdzonego mechanizmu lease/overlap. Wymaga przebudowy kursora i blokady przed włączeniem.
- Kursy nadal nie działają: `MOVIODDS_API_KEY` nie skonfigurowany, MoviOdds zwraca HTTP 401, a w provider_odds jest 0 świeżych niesuspendowanych kursów z ostatnich 6h. Job #10 pozostaje wyłączony. Kupony TEST mogą służyć do oceny hit-rate; MAIN/MEGA/EXTRA wymagają rzeczywistych świeżych kursów.
- Następny priorytet: poprawić cron predykcji na stabilny cursor/lease (nie offset zależny od godziny), przetestować pełny przebieg dzień po dniu; następnie znaleźć legalne autoryzowane źródło kursów bez klucza płatnego lub uzyskać bezpłatny dostęp dostawcy. Nie przedstawiać braku kursów jako rozwiązania.


## Automatyczny rejestr prac i audyt harmonogramu — 2026-11-16
- Utworzono tabelę `public.project_work_log` migracją `create_project_work_log`. Jest to trwały dziennik zadań inżynieryjnych: status, opis, zmienione pliki, commit, wdrożenie, wyniki testów i blokady. RLS jest włączone; brak publicznych polityk zapisu/odczytu.
- Pierwszy wpis: `auto-work-log-and-predict-scheduler-2026-11-16`, status `started`.
- Ponownie sprawdzono produkcyjny `cron.job`: job #11 `moneyball-global-auto-predict-sequential` pozostaje `active=false`. Jego stary SQL nadal liczy OFFSET jako liczbę minut od 08:00 × 10 i uruchamia się co minutę. Nie jest bezpieczny dla całodziennego skanowania: może pomijać nowe mecze, a OFFSET może przesuwać rekordy.
- Potwierdzono aktywną funkcję `moneyball-predict` v212. Nadal obsługuje `offset`/limit do 10, zwraca `has_more` na podstawie liczby rekordów surowej partii, a dopiero potem filtruje część zakresu w JS. Nie należy podłączać do niej automatycznego paginowania cronem w obecnej postaci.
- Kolejny krok: wprowadzić osobny, odporny mechanizm kolejki/kursora z lease, filtrem scope przed paginacją i automatycznym zapisem każdej próby do `project_work_log`; testy obejmą restart, timeout, nakładanie wywołań, nowo dodane mecze oraz brak pominięć/duplikatów.
- Blokada: przed aktywacją harmonogramu trzeba bezpiecznie zmienić kontrakt funkcji i sprawdzić schemat tabeli meczów oraz istniejące uprawnienia. Stary cron pozostaje wyłączony.


## Priorytet: naprawa automatycznego skanu — 2026-11-16
- Research techniczny: dokumentacja Supabase Cron zaleca ograniczać równoległość (maks. 8 zadań jednocześnie) i czas pojedynczego joba; Cron/pg_net jest oficjalną drogą wywoływania Edge Functions. Supabase Queues/pgmq zapewnia visibility timeout, ponowne dostarczenie i archiwizację, ale rozszerzenie `pgmq` nie jest zainstalowane w tej bazie. Zamiast dokładać rozszerzenie i nowy komponent, zastosowano prostszy mechanizm lease w PostgreSQL.
- Źródła techniczne: https://supabase.com/docs/guides/cron ; https://supabase.com/docs/guides/functions/schedule-functions ; https://supabase.com/docs/guides/queues/pgmq ; https://supabase.com/docs/guides/queues .
- Migracja produkcyjna zastosowana: `moneyball_prediction_scan_state`, `moneyball_claim_prediction_scan`, `moneyball_prediction_scan_page`, `moneyball_finish_prediction_scan`. Stan ma unikalny owner+date, token lease 5 min, cursor kickoff_at+UUID, cooldown 15 min po pełnym skanie, liczniki partii/meczów i retry po wygaśnięciu lease.
- Stronicowanie SQL wykonuje filtr europejskiej pierwszej/drugiej ligi i deduplikację globalnie przed LIMIT; kolejność `kickoff_at ASC NULLS LAST, id ASC`. Kursor oparty jest na parze kickoff_at+id, więc nie przesuwa stron jak OFFSET. Wykluczono kobiece/youth/reserve oraz zespoły II/III.
- Edge Function `moneyball-predict` wdrożona jako wersja 213 (verify_jwt=true). Tryb `mode=scheduled` pobiera lease, stronę SQL, zapisuje predykcje idempotentnie, a kursor przesuwa dopiero po zakończonym zapisie. Przy błędzie lease wygasa po 5 min, więc strona jest ponawiana; istniejące upserty chronią przed duplikacją.
- Test produkcyjny przez pg_net request 2587: HTTP 200 z Edge Function, `scheduled=true`, 8 kwalifikujących się fixture, 96 wierszy predykcji, 0 błędów, 0 duplikatów, status skanu `completed`, 1 batch, 8 meczów. Brak nowych wybranych typów jest prawidłowo zachowany (brak potwierdzonego kursu/danych dla większości).
- Test paginacji: strona 1 (limit 3) i strona 2 (limit 3) zwróciły rozłączne ID; obie raportują `has_more=true`. Test blokady: pierwsze claim `claimed=true`, drugie równoległe claim `claimed=false, reason=lease_active`.
- Cron #11 zaktualizowany i włączony: `moneyball-global-auto-predict-sequential`, co minutę, bez OFFSET. Lease blokuje nakładanie wywołań; ukończony skan odczekuje 15 min, po czym rozpoczyna pełny rescan, aby uwzględnić późno dodane fixtures. Po nieudanym wywołaniu lease wygasa i ten sam kursor jest ponawiany.
- Kod funkcji zapisany w GitHub: commit `c200d9fe93db8fa59038846505da35acc7617fe9`; poprawka składni i deploy commit `1e5a635b650548b4b5694484babb417da015b047`. Produkcyjna wersja Edge Function: 213.
- Migracja zapisana do repo: `supabase/migrations/20261116161500_add_cursor_leased_prediction_scheduler.sql` (commit `9b09b3238b423dd6d62443b754718161b49dc64c`).
- Uwaga: odpowiedź pg_cron/pg_net z kodem 200 sama w sobie nie potwierdza sukcesu funkcji. Należy kontrolować `net._http_response`, `moneyball_prediction_scan_state` oraz logi Edge Function. Pełna automatyzacja jest wdrożona, ale monitorować następne uruchomienie crona i kolejne 15-minutowe reskany.

- Potwierdzenie CI/Cloudflare dla commita dokumentacji `fcdf22f2d81b086634214085e8a18c84c908c859`: Moneyball CI run #727 / ID `43904503133` SUCCESS; Cloudflare deploy run #330 / ID `43904503189` SUCCESS.
- Automatyczny tick cron #11 o 16:10 UTC utworzył request Edge Function; pg_net response ID `2588` zwrócił HTTP 200 i `scheduled=true, skipped=true, reason=cooldown`, co potwierdza, że aktywny harmonogram nie dubluje skanu w okresie cooldown. W tym samym cyklu działał osobno results-sync (request `2589`, HTTP 200).

- Dodatkowy test pełnego ponownego skanu po wymuszeniu końca cooldown (request `2591`): HTTP 200, ponownie 8 meczów / 96 predykcji, 0 nowych duplikatów; 33 pending rekordy odświeżone, 63 settled/preserved zachowane, 0 nowych rekordów. Stan wrócił do `completed` i zaplanował kolejny pełny rescan na 16:27:02 UTC. Potwierdza to idempotencję przy powtarzaniu pełnego skanu.


## Kontynuacja — naprawa wykluczania rezerw i lig młodzieżowych — 2026-11-16
- Audyt po wznowieniu pracy wykazał podwójnie escapowane granice słów PostgreSQL (\\m/\\M). Test bezpośredni potwierdził, że taki wzorzec nie wykrywał Polissya II; poprawny wariant \m/\M wykrywa go prawidłowo.
- Zastosowano produkcyjne migracje poprawiające funkcję moneyball_is_european_top_two_league oraz RPC moneyball_prediction_scan_page. Filtr odrzuca puchary/play-off, ligę trzecią i niższe, kobiece/youth/U15-U23, reserves, B team i II/III. Zachowano możliwość inferencji mężczyzn przy pustym polu gender, ale markery youth/reserve są odrzucane niezależnie od gender.
- Test produkcyjny po migracji: Polissya II i Celta de Vigo II teams_ok=false; Serie C, Frauen Bundesliga i Druha Liga odrzucone; Persha Liga, Super League 2 i standardowy mecz Premier League dopuszczone.
- W silniku JS moneyball-predict poprawiono fixtureGender, by nazwa rezerw/youth miała pierwszeństwo przed błędnym gender=men; dodano odrzucanie pucharów/play-off w isTopTwoTierLeague. Filtr kuponów isCouponCandidate odrzuca rezerwy/B-teamy także przy błędnym oznaczeniu męskim. Dodano testy dla Polissya II, Celta de Vigo II i Bayern Munich B.
- Zmiany kodu: edge commit ec595fbe7687f83b161b0c34726cdc884736d727; domain commit 6a76378d6dcc5fef4d577766b6c24e3b1d41c0b6; test commit 3561ffc9a104ba016e97cf0a3fd89a26ac7c1b0f; migracja repo commit df3e09e666a36be5a7bda9127a3cb3639f489fb8.
- Edge Function moneyball-predict wdrożona jako wersja 214 (verify_jwt=true), kod pobrany bezpośrednio z main. Należy jeszcze potwierdzić CI/Cloudflare i następny cron tick.
- Dokumentacja Supabase potwierdza deploy Edge Functions przez MCP/CLI i CI/CD; Cloudflare rekomenduje Workers Builds lub GitHub Actions. Hosting frontendu pozostaje Cloudflare Workers — bez Vercel.
- Tabela provider_odds ma provider_polled_at, price_timestamp i captured_at; nie ma polled_at. Job kursów #10 pozostaje wyłączony. Nie włączać MAIN/MEGA/EXTRA bez prawdziwych świeżych kursów.

- Wynik po poprawce regex: GitHub Actions CI #735 (run 43907083881) zakończony SUCCESS — deno check, Vitest (50/50), TypeScript i build. Cloudflare Workers deploy #338 (run 43907083793) zakończony SUCCESS — wszystkie kroki, w tym deploy, zielone. Wcześniejszy run #337/#734 wykrył błąd w nowym teście JS (podwójnie escapowane \b w domain.ts); poprawiono w commicie b7404c59b41a42852de0568dfb92e867679704cc, po czym cały pipeline przeszedł.
- Weryfikacja harmonogramu po poprawce: cron #11 nadal aktywny co minutę; requesty 2609 i 2610 zwróciły HTTP 200 i `skipped=cooldown` przed zaplanowanym rescanem 16:27:02 UTC. To oczekiwane — nie ma równoległego skanu. Results-sync request 2608 zwrócił HTTP 200, `predictions_settled=26`, `results_saved=2`, `errors=[]`; coupon_legs_settled=0, bo żaden z aktualnie oczekujących kuponowych meczów nie został jeszcze potwierdzony jako zakończony w tym wywołaniu.
- Aktualny rejestr wirtualny: saldo 73,85 EUR (91,60 start, 24,00 łącznie stawek, 5,25 zwrotu). Dwa bieżące kupony TEST mają po 4 EUR, 3 nogi każdy; pozostają pending. Nie zmieniano historii i nie dopisywano sztucznych wyników.
- Ostatni audyt kursów: 219 022 wiersze historyczne, ale 0 świeżych, niesuspendowanych kursów prematch z ostatnich 6h; ostatni polling 02:11 UTC. Job kursów #10 pozostaje wyłączony.


## Dalsze usprawnienia filtrów i szybkości strony kuponów — 2026-11-16
- Dodatkowy audyt wykazał, że JS-owy filtr lig nie miał aliasu kosowskiej pierwszej ligi Liga E Pare, a jednocześnie zawierał błędny alias ukraińskiej trzeciej ligi Druha Liga. Skorygowano: Druha Liga jest wykluczona, Liga E Pare dopuszczona. W SQL poprawiono granice słów PostgreSQL oraz wykluczanie rezerw/youth przy gender=men i pustym gender.
- Rezerwy wykrywane także po nazwach bez prostego sufiksu II/III/B: Celta Fortuna, Real Madrid Castilla, Valencia Mestalla, Betis Deportivo, Sevilla Atletico. UCSA–Polissya II, Celta de Vigo II, Panionios–Olympiakos Piraeus II i inne rezerwowe są wykluczane. Dodano testy dla typowych nazw rezerw i B-teamów.
- Produkcyjna weryfikacja po wdrożeniu Edge Function v217 i SQL migrations: automatyczny scan request 2622 HTTP 200, 8 meczów, 96 wierszy predykcji, 8 nowych, 21 zaktualizowanych, 67 zachowanych, 0 duplikatów, 0 błędów, 0 WYBRANY (brak wystarczających danych/kursów), `couponCreated=false`. Kursor zamknął skan i zaplanował następny na 16:50:10 UTC. To potwierdza, że skaner nie pomija już dopuszczonej ligi Liga E Pare, a zakres pozostaje ograniczony do ligi krajowej top-two.
- Edge Function `moneyball-predict` aktywna v217. Kod: commit `54609db92e1a6be801ad3d27b3f870a8d2627d02`; GitHub CI #745 SUCCESS; Cloudflare Workers deploy #348 SUCCESS. Wcześniejszy deploy #347 dla wydajności strony kuponów również SUCCESS.
- Usprawnienie czasu wejścia do strony Kupony: loader nie pobiera już nieużywanej całej tabeli `bankroll_transactions` ani całej historii `scan_runs`. Zamiast tego pobiera tylko jeden najnowszy scan_run przez indeksowany query (owner_id + started_at DESC + LIMIT 1), cache 60 s. Nadal pełne tabele matches/predictions/coupons/coupon_legs/match_results są pobierane i pozostają następnym kandydatem do paginacji/zakresowych RPC — nie deklarować jeszcze pełnej optymalizacji nawigacji.
- CI dla wydajności strony: Moneyball CI #744 SUCCESS; Cloudflare deploy #347 SUCCESS. CI dla końcowej poprawki zakresu: #745 SUCCESS; Cloudflare deploy #348 SUCCESS. Typecheck Deno, testy, TypeScript i build przeszły.
- Research kursów bez klucza: znaleziony publiczny TipsAudit feed jest feedem fair-odds (kursy bez marży), nie cenami konkretnego bukmachera — nie może być użyty do payout ani kuponów MAIN/MEGA/EXTRA. Publiczne repozytoria scraperów OddsPortal wymagają Playwright/Chromium i pobierają strony serwisu; nie są stabilnym oficjalnym API, więc nie wdrożono ich do produkcyjnego Workera bez sprawdzenia warunków serwisu. OddsPapi/PinnFeed i PitchAPI wymagają kluczy. Brak potwierdzonego, bezkluczowego źródła rzeczywistych kursów Bwin BE. Źródła research: https://tipsaudit.com/api ; https://github.com/Bedbin17/oddsportal_scraper ; https://github.com/jordantete/OddsHarvester ; https://docs.oddspapi.io .
- Stan finansowy z księgi: saldo wirtualne 73,85 EUR. Dwa kupony TEST po 4 EUR / 3 nogi pozostają pending. Results-sync w ostatnim sprawdzeniu zwrócił HTTP 200, 26 predykcji rozliczonych, 2 wyniki zapisane, 0 błędów, 0 nóg kuponowych rozliczonych. Nie dopisywać fikcyjnego zwrotu ani zysku.


## Optymalizacja ekranu Kupony — pobieranie danych tylko do potrzeb widoku — 2026-11-16
- Poprzedni ekran Kupony ładował kompletne tabele matches (2 596 wierszy) i predictions (18 563 wiersze), choć do generowania kuponów potrzebne są prognozy dzisiejszych spotkań, a do historii jedynie rekordy powiązane z nogami kuponów. W bazie jest 9 kuponów i 22 nogi.
- Zmieniono `fetchCouponPageData`: pobiera mecze tylko z bieżącego dnia Europe/Brussels (oddzielnie rekordy z kickoff_at i bez kickoff_at), prognozy tylko dla tych meczów plus prognozy wskazane przez 22 nogi kuponów, kupony i nogi kuponów oraz wyniki tylko dla meczów powiązanych z kuponami. Dla dużych list ID używa paczek po 100, z filtrem owner_id. Nie zmienia zasad kuponów, stawek, kursów ani rozliczeń.
- Strona Kupony używa jednego cache'owanego query `coupon-page-data`, a loader nie inicjuje pełnego pobierania historycznych tabel matches/predictions. Mutacje kuponów unieważniają nowe query, więc widok po zapisie/anulowaniu odświeża dane.
- Zmiana początkowo nie przeszła TypeScript z powodu niezabezpieczonego destructuringu daty; poprawiono wartości domyślne. Ostateczny CI #752 SUCCESS: Deno typecheck, Vitest 50/50, TypeScript i build. Cloudflare Workers deploy #355 SUCCESS.
- Commit wdrożenia: `a14406ac25634af40cdb8bddf82cf5b4469956a1`. Wcześniejszy CI #751/#750 nie przeszedł przez TS18048/TS2769 w wyliczeniu następnego dnia; poprawiono i zweryfikowano w #752.
- Źródła research wykorzystane przy decyzji: Supabase Query Optimization i Postgres Indexes zalecają filtrowanie według rzeczywistego wzorca zapytań oraz indeksy złożone/częściowe zamiast niepotrzebnych pełnych skanów; Cloudflare Workers Cache ma ograniczenia dla odpowiedzi uwierzytelnionych (`Authorization` omija cache), dlatego nie włączano globalnego cache na prywatne dane użytkownika. Linki: https://supabase.com/docs/guides/database/query-optimization ; https://supabase.com/docs/guides/database/postgres/indexes ; https://developers.cloudflare.com/workers/cache/ .
- Weryfikacja zakresu danych w bazie: 2 596 meczów, 18 563 prognozy, 9 kuponów, 22 nogi i 874 wyniki. Nowy ekran nie pobiera już całej historii 2 596/18 563 rekordów — pobiera tylko dzisiejszą pulę oraz rekordy referencyjne kuponów. Nie wykonano jeszcze pomiaru czasu interaktywnego na urządzeniu użytkownika; nie deklarować procentowej poprawy bez telemetrii.
- Pozostają: pełna paginacja ekranu Mecze i pozostałych widoków; brak świeżych kursów bukmacherskich; brak pełnego E2E rozliczenia kuponu do bankrolla. Nie tworzono sztucznych wyników ani nowych stawek.


## Optymalizacja strony Mecze + indeksy ekranów meczowych/kuponowych — 2026-11-16
- Audyt potwierdził, że ekran Mecze już w UI pokazuje wyłącznie dzisiejsze mecze Europe/Brussels, ale jego loader pobierał wcześniej całe tabele matches/predictions/results/odds/coupons/coupon_legs. To był zbędny koszt sieci i pamięci.
- Dodano `fetchMatchPageData()` i query `match-page-data`: ładuje wyłącznie mecze dzisiejszego dnia, prognozy tych meczów, wyniki dzisiejszych spotkań, kursy i nogi kuponów powiązane z dzisiejszymi prognozami oraz same kupony referencyjne. Historię skanów ograniczono do 100 najnowszych wpisów. Wszystkie odczyty są owner-scoped, a duże listy ID dzielone na partie po 100.
- Loader Mecze korzysta teraz z jednego query zamiast `ensureTables` dla siedmiu pełnych tabel. Cache ma 5-minutowy polling, a mutacje unieważniają query Mecze i Kupony.
- Z audytu statystyk Postgresa: `coupon_legs` miało 311 818 seq_scan przy 22 wierszach, a istniejące indeksy były pojedynczo po coupon_id/prediction_id lub owner_id. Dodano indeksy złożone `(owner_id,prediction_id)` i `(owner_id,coupon_id)`, a także `(owner_id,created_at DESC)` dla kuponów oraz `(owner_id,prediction_id)` dla odds_snapshots. Migracja Supabase: `moneyball_coupon_screen_composite_indexes_20261116`.
- Źródła: oficjalna dokumentacja Supabase Query Optimization (filtry, JOIN, ORDER BY i indeksy złożone/częściowe), Postgres Indexes oraz Query Plans; materiały podkreślają pomiar EXPLAIN/Index Advisor i unikanie nadmiarowych indeksów. https://supabase.com/docs/guides/database/query-optimization ; https://supabase.com/docs/guides/database/postgres/indexes ; https://supabase.com/docs/guides/api/query-plans .
- Kod ekranu Mecze i query: commit `dcdbb0b2804a46930a9bbe16b386253be0add8c0`; unieważnianie cache po mutacjach: `10d0f62f53e00290abd52457fd517842b38be807`. CI #757 SUCCESS (50/50 testów, Deno, TypeScript, build). Cloudflare deploy #360 był w toku przy dopisywaniu wpisu; potwierdzić status przed deklaracją wdrożenia.
- Uwaga: `coupon_legs` statystyki seq_scan/idx_scan są globalnymi licznikami instancji, nie dowodzą same w sobie wolnego pojedynczego requestu. Dodane indeksy wynikają z rzeczywistych filtrów owner_id + prediction_id/coupon_id. Należy po wdrożeniu sprawdzić plany i metryki, zamiast zakładać konkretny procent przyspieszenia.
- Nie włączono kursów automatycznie: cron #10 nadal nieaktywny; cron #11 prediction scan aktywny co minutę z lease/cursor. Brak potwierdzonego feedu bukmacherskiego nadal blokuje MAIN/MEGA/EXTRA. Brak nowych stawek i fikcyjnych rozliczeń.


## 2026-11-16 — audyt rozliczania kuponów i zabezpieczenie idempotencji bankrolla
- Priorytet: automatyczne rozliczanie kuponów po zweryfikowanym wyniku, wyliczenie wypłaty netto/brutto przy stawce TEST 4 EUR oraz spójność bankrolla.
- Audyt 6 nóg pending wykazał, że nie są to 6 zakończonych, nierozliczonych meczów: Faroe Islands–Moldova ma status live bez wyniku końcowego; Iceland–Luxembourg i Lithuania–Liechtenstein były jeszcze przed kickoffem; Switzerland–Scotland, Greece–Serbia i Gibraltar–Malta również miały kickoff później tego wieczoru. Nie rozliczać ich przed potwierdzonym FT.
- Oba kupony z 16.11 są TEST, mają po 3 nogi, stawkę 4.00 EUR, status pending i 6/6 nóg pending — zgodnie ze stanem spotkań w chwili audytu. MAIN z 16.11 (1 noga) jest już won, stawka 5.00 EUR, payout 5.25 EUR. Historyczne rekordy mają starsze stawki 5.00 EUR lub 0.00 EUR; nie przepisywać ich na 4 EUR wstecz.
- Bankroll ledger zweryfikowany: depozyt 91.60 EUR, stawki 5+5+5+4+4 EUR, zwrot 5.25 EUR; saldo księgowe 73.85 EUR. Dwa aktualne kupony TEST po 4 EUR zostały już obciążone w ledgerze. To jest saldo po zapisanych transakcjach, bez przyszłych rozliczeń.
- Audyt kodu `supabase/functions/moneyball-results-sync/index.ts`: wynik FT jest zapisywany do match_results, predykcje rozliczane, powiązane coupon_legs aktualizowane przez prediction_id, kupony agregowane, a `reconcileCouponMoney` buduje zwrot i saldo. Reconciliation jest odpalana ponownie przy każdym cyklu i uwzględnia nogi oczekujące. Ważne: wiele zapisów odbywa się przez osobne REST PATCH/POST, więc same ponowienia nie dają atomowości; brakowało ograniczeń unikalności dla stake/return w ledgerze.
- Zastosowano migrację Supabase `moneyball_coupon_ledger_idempotency_guards_20261116`; dodano unikalne indeksy częściowe: jeden `stake` i jeden `return` na coupon_id. Potwierdzono istnienie obu indeksów w pg_indexes. Nie wykryto wcześniej duplikatów ledgerowych. Plik migracji dodany do repo: `supabase/migrations/20261116180000_coupon_ledger_idempotency_guards.sql`, commit `5187e16d70f680969b902f2fc6cd38b888607024`.
- Cron wyników (job #2) jest aktywny co 5 minut. Cron predykcji (#11) co minutę. Odds cron #10 pozostaje wyłączony.
- Źródła techniczne: Supabase Webhooks dokumentuje dostarczanie at-least-once, duplikaty i zdarzenia poza kolejnością — wymagane klucze deduplikacji i trwałe rejestry; Supabase Scheduling Edge Functions dokumentuje pg_cron + pg_net; Supabase Cron dokumentuje historię wykonań i limity; Supabase Edge Functions zaleca krótkie, idempotentne operacje i retry. Reguły Betfair pokazują, że postponement/abandonment wymaga osobnych reguł void, nie można uznać samego braku wyniku za porażkę.
- Linki: https://supabase.com/docs/guides/platform/webhooks ; https://supabase.com/docs/guides/functions/schedule-functions ; https://supabase.com/docs/guides/cron ; https://supabase.com/docs/guides/functions ; https://support.betfair.com/app/answers/detail/a_id/10240/ .
- Ograniczenie researchu społecznościowego: rozszerzone TinyFish deep research nie wystartowało, ponieważ narzędzie zgłosiło pusty portfel. Nie będę udawał, że przeanalizowałem płatne raporty, fora ani pełny internet; wykorzystano dostępne oficjalne źródła i audyt własnego kodu/bazy.
- Status: zabezpieczenie unikalności wdrożone w bazie i zapisane w repo. Nie deklarować jeszcze pełnego E2E po zakończeniu meczu — wszystkie 6 nóg aktualnych kuponów pozostawało pending w chwili audytu; należy potwierdzić automatyczny settlement po końcowych wynikach i sprawdzić saldo po tym cyklu.


## 2026-11-16 — atomowe rozliczanie finansów kuponu (kolejny etap naprawy)
- Research web/forum/GitHub: potwierdzono praktyczny wzorzec: dostarczanie at-least-once + trwała unikalność w PostgreSQL + jedna transakcja DB dla efektu finansowego; sama kontrola SELECT przed INSERT ma race condition. Przejrzano m.in. Supabase Database Webhooks (pg_net async, monitoring historii), Supabase Cron/Functions scheduling, dyskusje Supabase o błędach/retry, Reddit o duplikatach i zdarzeniach poza kolejnością oraz repozytorium ledgerline z przykładem row locks + ON CONFLICT + testów współbieżności.
- Dodatkowe źródła piłkarskie: open-matchday ma 75 lig i wyniki bez klucza, ale tylko dzienne odświeżanie, brak live i licencja non-commercial — nie nadaje się jako samodzielny final-score source do rozliczania w 5-minutowym cyklu. openfootball/football.json jest public domain, ale aktualizuje się raz dziennie i sam projekt zastrzega brak gwarancji aktualności. Publiczny Flashscore scraper repo może zwracać statusy/FT i score bez klucza, ale to kod scrapera, nie gwarantowany hostowany feed; należy testować jako kandydat, nie traktować jako potwierdzony upstream.
- Źródła/linki: https://supabase.com/docs/guides/database/webhooks ; https://supabase.com/docs/guides/functions/schedule-functions ; https://supabase.com/docs/guides/cron ; https://github.com/orgs/supabase/discussions/52616 ; https://github.com/supabase/pg_net/issues/110 ; https://reddit.com/r/softwarearchitecture/comments/1v8vkrp/idempotency_in_eventdriven_systems_how_do_you ; https://reddit.com/r/dotnet/comments/1xjg3bw/idempotency_doesnt_solve_outoforder_webhooks ; https://github.com/kamilch1k/ledgerline ; https://github.com/oladeeayo/open-matchday ; https://github.com/openfootball/football.json ; https://github.com/clearfetch/flashscore-football-scraper .
- Główna zmiana: nowa funkcja PostgreSQL `public.moneyball_reconcile_coupon_finance(uuid)` wykonuje w jednej transakcji: blokadę kuponu FOR UPDATE, serializację przebudowy salda advisory lock per owner, wyliczenie statusu z nóg, kursu łącznego, potencjalnego zwrotu, wpisu stake/return z ON CONFLICT, oraz przebudowę balance_after. Ograniczenia unikalności stake/return z poprzedniej migracji pozostają ostatnią linią ochrony.
- Edge Function `moneyball-results-sync` zmieniona tak, by `reconcileCouponMoney` wywoływała RPC zamiast wykonywać rozproszone PATCH/POST. Kod commit: `f2002cce31d85708fe3d51311a106f79130ced3e`. Funkcja Supabase wdrożona bezpośrednio jako wersja 65, status ACTIVE, SHA `d17d71f6910871cfb5605b1a4adfe4f8ec5d9431fe9d92352bfd19136832d193`.
- Test idempotencji na rzeczywistym kuponie TEST pending: dwukrotne wywołanie RPC zwróciło w obu próbach identyczny wynik: status pending, 3 pending legs, odds 1.09, potential_return 4.36, payout null, balance 73.85. Nie zmieniono statusu żadnej nogi; nie dodano drugiej stawki ani fikcyjnej wypłaty.
- Stan testowanych kuponów: dwa kupony TEST po 4 EUR nadal pending (3/3 nogi każdy). Ich mecze miały w bazie kickoff/statusy: Faroe Islands–Moldova live bez FT; Iceland–Luxembourg i Lithuania–Liechtenstein scheduled na 17:00 UTC; Gibraltar–Malta, Switzerland–Scotland i Greece–Serbia scheduled na 19:45 UTC. Zatem 6 pending nóg jest zgodne z terminarzem; settlement po FT dopiero zweryfikuje cały proces.
- Wynik ostatniego results-sync sprzed wdrożenia wersji 65: HTTP 200, 79 fixtures fetched, 10 matched, 2 results saved, 26 predictions settled, 0 coupon legs settled, brak errors; financial reconciliation 5 checked / 0 failed. Ten wynik nie jest testem nowego kodu.
- Kryterium końcowe pozostaje: po FT przynajmniej jedna noga musi przejść automatycznie do won/lost/void, status kuponu musi się zaktualizować, payout/net P&L musi być prawidłowy, saldo ma zmienić się dokładnie raz, a kolejny cykl nie może dopisać drugiego wpisu. Nie deklarować jeszcze pełnego E2E.


### Weryfikacja po wdrożeniu Edge Function v65
- Cron results-sync uruchomił nową wersję o 17:10 UTC i zwrócił HTTP 200, `ok:true`, financial_reconciliation: 5 checked / 0 reconciled / 0 failed / errors [], 79 fixtures, 10 matches, 2 nowe wyniki, 26 rozliczonych predykcji, 0 nóg kuponów, 0 błędów. Zero nóg jest zgodne z aktualnymi stanami meczów, a nie błędem RPC.
- Dodatkowy test transakcyjny: tymczasowo oznaczono nogi kuponu TEST jako won, wywołano RPC i sprawdzono, że tworzy jeden wiersz zwrotu; cała symulacja została wycofana przez ROLLBACK. Następne zapytanie potwierdziło stan pierwotny: kupon pending, 3 nogi pending, 0 wierszy return. Test nie zmienił prawdziwych wyników ani salda.
- Test dwukrotnego wywołania RPC na pending zwrócił dwa identyczne salda i brak payout; cron po deployu przeszedł bez błędów. Oczekujemy na pierwszy faktyczny FT z kuponów 4 EUR, aby zamknąć test E2E.


### Kontrola produkcyjna po v65 — 2026-11-16, 17:15 UTC
- Ponowny odczyt relacji coupon_legs/coupons/predictions/matches/match_results wykazał 6 nóg pending na dwóch kuponach TEST po 4.00 EUR. Faroe Islands–Moldova: status live, bez końcowego wyniku; pozostałe pięć spotkań miało status scheduled i kickoff w późniejszej części dnia. Brak automatycznego settlement w tym momencie jest zgodny ze stanem spotkań; nie zmieniono wyników ani salda.
- Cron job #2: ostatnie 10 wykonań (16:30–17:15 UTC) ma status succeeded. Odpowiedź funkcji results-sync z 17:15 UTC: HTTP 200, ok=true, 79 fixtures fetched, 10 matched (8 external ID, 2 team names), 2 results saved, 26 predictions settled, 0 coupon legs settled, 0 errors; reconciliation 5 checked / 0 failed.
- Odpowiedź 17:15 miała upstream service time 14.593 s. Cron succeeded potwierdza zakolejkowanie pg_net, nie jest pomiarem czasu funkcji. Opóźnienie Edge Function wymaga profilowania etapów; nie przycinać źródeł wyników bez testu pokrycia.
- Job predykcji zwracał HTTP 200 skipped=cooldown w kolejnych minutach — zgodnie z lease/cooldown.
- Potwierdzone saldo ledgeru pozostaje 73.85 EUR. Nie dopisano wypłat ani fikcyjnych wyników.
- Następny warunek E2E: rzeczywisty zweryfikowany FT -> settlement prediction i coupon_leg -> status kuponu -> pojedynczy payout i saldo; następny cykl musi być idempotentny.



## Kontynuacja MONEYBALL GLOBAL MAIN — audyt nawigacji, 2026-11-16 (21:xx Europe/Brussels)
- Nienaruszalny cel: wyłącznie produkcyjny Cloudflare Worker `moneyball-global`, repozytorium `damianwalus3-jpg/moneyball-global`, branch `main`. Nie zmieniać środowiska na TEST, nie przywracać Vercel, nie cofać wcześniejszych zmian.
- Ponownie odczytano ten dziennik oraz aktualny kod gałęzi `main`. Najnowszy HEAD widoczny w historii commitów: `3ff65de9c707842e6eb20e4110bcf3d2fe642294` (dokumentacja optymalizacji zakładki Typy), poprzedzony `ea82a03b4e0601150c8529726bc365d8eba46d41` (pobieranie tylko widocznych prognoz i lazy-load pełnego selektora meczów), `ad09f15f50d13533b4748304a5485a72956d84bb` (zapis wdrożenia optymalizacji Historii), `0658b2db5183d12578d2a80d38e16b103907fce1` (nawigacja Historii nie blokuje przejścia; pierwsza strona pobierana w tle), `61d6920b6dc0ae83440c49e0c4fe45d8d5ff91f5` (zapis wdrożenia deduplikacji CSV) i `f8004c60032323b7bff72b9850944b5687b4aed2` (ograniczone, owner/match scoped i paginowane wyszukiwanie duplikatów importu).
- Aktualny `src/lib/queries.ts` potwierdza cache TanStack Query: LIVE summary stale 10–15 s / polling 30 s; duże tabele domyślnie stale 120 s bez pollingu; matches polling 15 min; match_results 5 min; coupons/coupon_legs 60 s; wyniki i historia korzystają z infinite queries i kursorów; dane stron Mecze/Kupony mają osobne query i cache. To są ustawienia kodu, nie pomiar rzeczywistego czasu kliknięcia.
- Zmiana Typy ma ograniczać pobieranie do widocznych meczów i odkładać pełny picker do otwarcia formularza. Zmiana Historii usuwa zbędne preloady całych tabel i pobiera pierwszą stronę w tle. Wcześniejsze optymalizacje Mecze/Kupony ograniczyły duże odczyty. Nie deklarować końcowego rozwiązania szybkości bez pomiaru zalogowanego panelu.
- Rzeczywisty pomiar przejść między zakładkami, czasu odpowiedzi Supabase w przeglądarce użytkownika, transferu JS/danych oraz ponownego pobierania po powrocie nadal NIE został wykonany — brak zalogowanej sesji. Publiczny Worker nie został w tej sesji zweryfikowany przez web fetch, a samo CI/deploy nie zastępuje testu UI.
- Przygotowano bezpieczny Browser Context Profile do zalogowania wyłącznie do MONEYBALL MAIN: nazwa `MONEYBALL GLOBAL MAIN – pomiary menu`, profile ID `prof_bb80729b439c4bb0`. Użytkownik musi otworzyć jednorazowy setup URL przekazany w rozmowie, zalogować się bez ujawniania hasła w czacie i kliknąć Save profile. Po zapisaniu można wykonać rzeczywiste testy UI w tej sesji.
- Następny krok po zapisaniu profilu: przejść po każdej zakładce (Panel, Mecze, Typy, Kupony, Historia, Wyniki, Statystyki i pozostałe dostępne), wykonać co najmniej dwa przebiegi nawigacji, zapisać czasy start->interaktywny widok, czasy requestów Supabase, liczbę/rozmiar odpowiedzi i transferu JS, cache hit/miss oraz requesty powtórzone po powrocie. Oddzielić czas renderu od czasu backendu. Nie logować ani nie ujawniać tokenów/cookies.
- Po pomiarach wprowadzać małe poprawki na branch `main`, dodać testy regresyjne, potwierdzić CI i Cloudflare deploy, a następnie dopisać liczby i SHA do tego pliku. Do tego czasu status szybkości menu: OTWARTE / NIEPOTWIERDZONE.
- Pozostałe niezależne blokady projektu nadal obowiązują: brak potwierdzonego świeżego źródła rzeczywistych kursów bukmacherskich bez klucza (nie używać starych kursów); pełny E2E kupon->FT->rozliczenie->jednorazowy payout->saldo wymaga potwierdzenia po rzeczywistym FT. Nie zmieniać stawek historycznych, nie tworzyć fikcyjnych wyników ani wypłat.



## MONEYBALL GLOBAL MAIN — odroczenie archiwum meczów w imporcie CSV — 2026-11-16
- Kontynuowano pracę wyłącznie na produkcyjnym repozytorium `damianwalus3-jpg/moneyball-global`, branch `main`. Nie dotykano Vercel jako hostingu produkcyjnego ani środowiska TEST.
- Nowy audyt kodu wykazał dodatkowy, konkretny koszt nawigacji: `ScanImportDialog` jest montowany na stronie Mecze również wtedy, gdy okno importu jest zamknięte, ale od razu wykonywał `useTable("matches")`. To uruchamiało pobranie całego archiwum meczów (ostatni znany baseline 2 596 rekordów) i mogło wstrzymywać render strony przez Suspense, mimo że użytkownik nie otwierał importu.
- Poprawka w `src/components/app/ScanImportDialog.tsx`: zastąpiono `useTable` przez `useQuery({ ...tableQuery("matches"), enabled: open })`. Pełna lista meczów pobierana jest dopiero po otwarciu okna importu. Podczas pobierania wyświetlany jest komunikat; przy błędzie pobrania import jest zablokowany, aby nie ryzykować duplikatów. Dotychczasowy mechanizm deduplikacji i zapisów pozostaje bez zmian.
- Commit poprawki: `a1d67792756c01c0363f17a1b6220ae1d1cee725`; następny commit porządkujący literalne znaki nowej linii: `8ebc7efe750e2843c18e14fee90f701825317651`. Aktualny plik ponownie odczytany z `main`; importy i JSX komunikatu ładowania/błędu są obecne.
- Kontrola statusu commita `8ebc7efe...`: jedyny zwrócony check to `Vercel=failure` z przyczyną build-rate-limit. To nie jest host produkcyjny. Nie otrzymano potwierdzenia GitHub CI ani Cloudflare Worker deploy dla tego commita; dlatego zmiana jest ZAPISANA NA MAIN, ale jej wdrożenie na Cloudflare i test produkcyjny pozostają NIEPOTWIERDZONE. Nie ogłaszać sukcesu wdrożenia.
- Oczekiwane zachowanie: wejście na Mecze nie powinno już inicjować pobierania pełnego archiwum wyłącznie z powodu zamkniętego dialogu CSV; otwarcie importu nadal pobiera archiwum, aby zachować obecny algorytm wykrywania istniejących meczów. To jest odroczenie kosztu, nie usunięcie pełnego pobrania z samego procesu importu.
- Następny krok techniczny: potwierdzić GitHub CI i Cloudflare deploy dla SHA `8ebc7efe...`; następnie, po zalogowanej sesji MAIN, zmierzyć nawigację do Mecze przed/po i potwierdzić, że request pełnej tabeli matches pojawia się dopiero po otwarciu importu. Profil przeglądarki do pomiaru został przygotowany w poprzednim wpisie, ale wymaga ukończenia setup przez użytkownika; automatyzacja przeglądarki nie wystartowała z powodu zerowego salda TinyFish.
- Nie zmieniono żadnych rekordów meczów, prognoz, kuponów, wyników ani transakcji bankrolla. Brak zmian w stawkach, kursach i regułach typowania.



## MONEYBALL GLOBAL MAIN — odzyskanie kontekstu i potwierdzenie deployu — 2026-11-16 (kontynuacja)
- Użytkownik polecił kontynuować pracę, zapisywać postęp i przypomnieć poprzednie czaty projektu. Odzyskano kontekst rozmów z 13–16.11.2026 oraz ponownie odczytano repozytorium i dziennik projektu. Wiążące ograniczenia: repo `damianwalus3-jpg/moneyball-global`, branch `main`, produkcyjny Worker `https://moneyball-global.damianwalus3.workers.dev`; nie mylić z Workerem TEST ani Vercel. Nowe kupony: dokładnie 4 EUR; kupony AKO po 3 zdarzenia; tylko WYBRANY i >75%, świeże potwierdzone kursy; nie zmieniać historycznych stawek, wyników ani salda bez podstaw i nie tworzyć fikcyjnych wypłat.
- Bieżący HEAD gałęzi `main` potwierdzony przez GitHub API: `d5efb3c9a20ec0c6f2aa10330c2aa2e7d0bc3682`.
- Wcześniejszy wpis stwierdzał, że deploy Cloudflare dla tego SHA był niepotwierdzony. Ponowna kontrola Actions wykazała, że to już nieaktualne: CI run #829 (ID `43947774592`) zakończony `success`; Cloudflare deployment run #415 (ID `43947774586`) zakończony `success`. Wszystkie kroki deployu, w tym `Build for Cloudflare Workers` i `Deploy to Cloudflare Workers`, zakończone sukcesem. Jest to potwierdzenie wdrożenia kodu SHA `d5efb3c...` na Cloudflare, ale nadal NIE jest pomiarem wydajności zalogowanego UI.
- Aktualny odczyt `src/components/app/ScanImportDialog.tsx` potwierdza, że pełna tabela `matches` ładuje się dopiero po otwarciu dialogu CSV (`enabled: open`); błąd ładowania blokuje import. Wcześniejszy zapis pozostaje aktualny.
- Dodatkowy statyczny audyt wykazał potencjalne, niezmierzone koszty:
  1. `src/routes/_authenticated/bankroll.tsx` nadal używa `useTable("bankroll_transactions")` i `useTable("coupons")`, czyli pobiera pełne tabele dla widoku rejestru.
  2. `src/lib/coupons.ts` — `cancelCoupon` pobiera pełne tabele `coupons`, `coupon_legs`, `bankroll_transactions`, a potem ponownie cały ledger do przeliczenia salda.
  3. `src/lib/settlement.ts` — `reconcileCouponLedger` pobiera cały `bankroll_transactions` ledger, wyszukuje transakcje danego kuponu, a następnie pobiera ledger ponownie i aktualizuje balance_after rekord po rekordzie. To jest potencjalnie kosztowne i krytyczne finansowo; nie zmieniać tego bez sprawdzenia istniejących RPC, ograniczeń unikalności, transakcyjności i testów regresyjnych.
  4. `src/lib/queries.ts` ma bazowe `TABLE_REFRESH` stale 45 s i polling 60 s dla ogólnych tabel; wyjątki: matches 15 min, match_results 5 min, coupons/coupon_legs 60 s, predictions 120 s bez pollingu. Wcześniejsze podsumowanie o wszystkich dużych tabelach bez pollingu było uproszczeniem — aktualny kod jest źródłem prawdy.
- Ważny kontekst finansowy odzyskany z poprzednich czatów i starszych wpisów: wcześniej wdrożono SQL RPC `public.moneyball_reconcile_coupon_finance(uuid)` jako atomową ścieżkę rozliczeń automatycznego results-sync (Edge Function v65 w historycznym wpisie), z blokadą kuponu i advisory lock właściciela; test idempotencji pending i test symulacyjny przez ROLLBACK nie wykazały podwójnej wypłaty. Później results-sync v68 zwracał HTTP 200, ale pełne E2E wymaga rzeczywistego FT, przejścia nogi kuponu, pojedynczego payout i poprawnego salda. Ręczna ścieżka UI w aktualnym `settlement.ts` nadal wymaga osobnego audytu pod kątem użycia RPC.
- Znane pomiary z wcześniejszego audytu (nie są bieżącym pomiarem UI): 2,596 matches; 18,563 predictions; 9 coupons; 22 coupon legs; 883 match_results; 7 bankroll_transactions. Statystyki wcześniej ograniczono do ok. 1,141 rekordów prognoz dla aktywnego modelu/manual w kwalifikowanych ligach (ok. 93.9% mniej niż pełna tabela), a Historia, Typy i import CSV dostały optymalizacje z osobnymi potwierdzonymi deployami.
- Brak dostępnej w tej sesji bezpośredniej integracji Cloudflare do odczytu runtime metrics/Workers versions poza GitHub Actions. Nie udawać, że zmierzono TTFB, czas kliknięcia menu, transfer czy requesty zalogowanej sesji. Browser profile do pomiarów MAIN nadal wymaga ukończenia setup przez użytkownika; TinyFish automation wcześniej nie wystartował z powodu zerowego salda.
- Następne kroki: (a) audytować istniejące RPC i schemat ledgeru przed dotknięciem manual settlement/cancel; (b) zaprojektować scoped loader dla Bankroll i ograniczyć pełne fetchAll w cancel/settlement bez zmiany semantyki finansowej; (c) dodać testy idempotencji, korekty wyniku, anulowania i współbieżnych rozliczeń; (d) potwierdzić CI i Cloudflare deploy dla każdego kodowego commita; (e) wykonać pomiar zalogowanego UI po ukończeniu profilu; (f) po rzeczywistym FT zamknąć test E2E kupon -> payout -> saldo. Nie deklarować zakończenia szybkości ani pełnego E2E przed tymi dowodami.
- Nie wykonano w tym kroku żadnej modyfikacji danych produkcyjnych ani żadnego rozliczenia. To jest wpis dokumentacyjny i audyt statyczny.



## Rozszerzona naprawa bezpieczeństwa RPC i audyt runtime — 2026-11-16
- Ustalono właściwy aktywny projekt Supabase produkcyjnej aplikacji: `gzgeklcukrclgwbsmbsp` (`moneyball-global.`, region eu-west-1), status ACTIVE_HEALTHY. Projekt `xwrgfaarmwnguymresjy` (`moneyball-global-free`) jest odrębnym środowiskiem/duplikatem; nie wykonywać na nim zmian produkcyjnych. Potwierdzenie powiązania: aktywny Edge Function `moneyball-results-sync` v68 zawiera SUPABASE_URL wskazujący na `gzgeklcukrclgwbsmbsp`, a ten projekt ma bazowe liczności zgodne z aktualnym dziennikiem projektu.
- Read-only baseline produkcyjnej bazy: 2,596 matches; 18,563 predictions; 9 coupons (2 pending, 5 terminal, 2 pozostałe statusy); 22 coupon legs; 884 match_results; 7 bankroll_transactions; 219,022 provider_odds. Żadnych danych finansowych nie zmieniano podczas tego audytu.
- Runtime logs ostatnich 24h (do 2026-11-16 20:30 UTC):
  - `moneyball-predict`: 293 wywołania, średnio 2.813 s, p95 9.278 s, max 30.519 s, 0 HTTP 5xx.
  - `moneyball-results-sync`: 192 wywołania, średnio 8.865 s, p95 14.098 s, max 26.796 s, 0 HTTP 5xx.
  - `moneyball-free-feed`: 87 wywołań, średnio 2.390 s, p95 4.006 s, max 9.595 s, 0 HTTP 5xx.
  - `moneyball-public-sources`: 33 wywołania, średnio 5.130 s, p95 9.561 s, max 15.137 s, 0 HTTP 5xx.
  - `moneyball-movi-odds-sync`: 19 wywołań, średnio 4.306 s, p95 14.815 s, max 15.602 s, 7 HTTP 500. Cron job #10 jest obecnie `active=false`; nie włączać ponownie. Siedem błędów wystąpiło 03:11–08:45 UTC i nie pojawiły się później w badanym oknie.
- Weryfikacja finansowa: `public.moneyball_reconcile_coupon_finance(uuid)` jest SECURITY DEFINER, ma pusty search_path i ACL tylko `postgres` oraz `service_role`; zachowuje blokadę kuponu FOR UPDATE, advisory lock per owner, partial unique guards i jedną transakcję. Nie rozszerzono jej EXECUTE na authenticated/anon i nie zmieniono semantyki wypłat.
- Security advisor wykazał 6 funkcji SECURITY DEFINER wykonywalnych przez anon/authenticated. Trzy endpointy skanera (`moneyball_claim_prediction_scan`, `moneyball_finish_prediction_scan`, `moneyball_prediction_scan_page`) celowo pozostają dostępne dla anon, bo wywołuje je pg_net; każda sprawdza tajny token i zgodność ownera. Nie zmieniono ich grantów.
- Bezpiecznie ograniczono bezpośrednie wywołanie pomocników tokena i funkcji triggera: REVOKE EXECUTE dla PUBLIC/anon/authenticated na `moneyball_cron_token_valid(text)`, `moneyball_cron_owner_id(text)` oraz `settle_moneyball_predictions_for_result()`. Ostatnia pozostaje podpięta do triggera `trg_settle_moneyball_predictions` na `match_results` i trigger jest enabled; samo wykonanie triggera nie wymaga uprawnienia klienta do ręcznego RPC.
- Usunięto mutable search_path warning przez `ALTER FUNCTION public.moneyball_is_european_top_two_league(text,text) SET search_path = ''`; funkcja jest IMMUTABLE i korzysta wyłącznie z pg_catalog built-ins.
- Migracja zastosowana na produkcyjnym Supabase pod wersją `20261116203158`, nazwa `harden_moneyball_definer_function_permissions`; sukces potwierdzony. Plik źródłowy w repo: `supabase/migrations/20261116203158_harden_moneyball_definer_function_permissions.sql`, commit `9450451a33e10df6ed15b2fe07efd15f287d7af0`.
- Po migracji potwierdzono: anon/authenticated nie mogą wykonywać helperów tokena ani trigger function; service_role i postgres zachowują dostęp; trzy chronione RPC skanera pozostają dostępne tylko anon/service_role/postgres, authenticated nie ma dostępu. Health advisor: 0 findings. Security advisor: pozostały 3 cron RPC z token guard, 4 RLS-enabled/no-policy tabele (celowo prywatne/worker-managed), pg_net w public oraz leaked-password protection wyłączone. Nie zmieniać polityk tych prywatnych tabel bez audytu ścieżek workerów.
- Nie wprowadzono żadnego zapisu do kuponów, nóg, prognoz, wyników ani bankrolla. Nie wykonano testowego/pozornego rozliczenia.
- CI i Cloudflare deploy dla commita migracji repo `9450451...` muszą zostać sprawdzone po zakończeniu workflow. Migracja Supabase została już zastosowana niezależnie od wdrożenia frontendu.
- Otwarte zadania: (1) analizować etapowe logi `moneyball-results-sync` (p95 ok. 14.1 s), (2) prześledzić 7 błędów MoviOdds POST 500 — cron pozostaje wyłączony, (3) pełny E2E kupon po realnym FT i jednorazowy payout, (4) zalogowany pomiar menu, (5) sprawdzić manualną ścieżkę rozliczenia UI, która nadal ma pełne odczyty ledgeru; nie zastępować jej RPC service-only bez zaprojektowania bezpiecznego endpointu.


## Optymalizacja wyników — ograniczenie kosztu kontroli przełożonych meczów i zapytań alternatywnych — 2026-11-16
- Analiza logów wykazała, że `reconcileRescheduledMatches` pobierało 7 stron FootyNomad (kolejne 7 dni) przy KAŻDYM pięciominutowym uruchomieniu results-sync. Mierzone czasy tego etapu: 1.4–4.0 s, mimo że liczba zaktualizowanych meczów wynosiła 0. To było zbędne obciążenie głównej ścieżki synchronizacji wyników.
- Dodano singletonową tabelę `public.moneyball_reschedule_sync_state` oraz atomowy RPC `public.moneyball_claim_reschedule_sync()`. Lease pozwala wykonać 7-dniową kontrolę raz na 15 minut, również przy nakładających się wywołaniach; pozostałe cykle pięciominutowe omijają ten etap. Tabela ma RLS bez polityk i dostęp tylko dla service_role; funkcja SECURITY DEFINER ma pusty search_path i EXECUTE tylko dla service_role.
- Migracja Supabase `20261116203421_throttle_reschedule_reconciliation_to_15_minutes` zastosowana pomyślnie. Test RPC: pierwsze wywołanie zwróciło `true`, drugie natychmiastowe `false`; testowy znacznik został zresetowany do NULL. Nie zmieniono żadnego meczu ani danych finansowych.
- Edge Function `moneyball-results-sync` wdrożona bezpośrednio na produkcyjny projekt `gzgeklcukrclgwbsmbsp`:
  - v69: 15-minutowy lease dla reschedule lookup, 4 równoległe strony zamiast 3 oraz timeout 8 s dla każdego requestu FootyNomad.
  - v70/v71: alternatywne źródła wyników pomijają się, jeśli nie ma żadnych zaległych/rozpoczętych meczów do sprawdzenia; TheSportsDB pobiera wyłącznie dni, w których rzeczywiście są takie mecze; OpenLigaDB jest odpytany tylko wtedy, gdy wśród due fixtures znajduje się liga niemiecka. Poprawiono też regex wykrywania Bundesligi.
  - Aktualna wersja Edge Function: v71 ACTIVE, verify_jwt=false (zachowano dotychczasowe ustawienie), SHA artefaktu `d28c7fec62f20fd56c04d4e1b70e51e9398b9a82a3b881df6de8e13af625e946`.
- Źródło zmian zapisane w GitHub `main`: migracja lease commit `70b7f3155c17bf73572a826ce55cbf895af7ffac`; throttling + timeout commit `c1b09e1e9c37eb8086584ec5bd68d798f72fec24`; warunkowe źródła commit `82eecdc46c2dd4d8536a3724530a90758a0dbbc8`; poprawka regex commit `885f471ba5da0bee42fd6639c24624c4805cfedd`.
- Ostatni dostępny pomiar z 20:35 UTC pochodził jeszcze z wywołania rozpoczętego przed aktywacją v69/v71: reschedule 1.401 s, alternate sources 1.237 s, wynik processing 1.515 s, financial reconciliation 96 ms, request summary bez błędów. Nie traktować tego jako pomiaru po poprawce; wymagany jest kolejny cron po wdrożeniu v71.
- W poprzednim oknie 24h results-sync: 192 wywołania, średnio 8.865 s, p95 14.098 s, max 26.796 s, 0 HTTP 5xx. Po zmianach zmierzyć ponownie ten sam zestaw metryk i rozdzielić oszczędność reschedule/alternates.
- Weryfikacja GitHub Actions dla commitów Edge Function/migracji była w toku przy ostatnim odczycie: CI #833/#834/#835; Cloudflare deploy #421 dla SHA `c1b09e1...` in progress; wcześniejsze Cloudflare runy #419/#420 zostały anulowane przez concurrency. Ponieważ zmiany Edge Function wdrożono bezpośrednio w Supabase, Cloudflare Worker nie zawiera logiki Edge Function; nie uznawać CI/deploy Worker za test Edge Function.
- Nie zmieniono harmonogramu głównego results-sync (pozostaje co 5 minut), nie włączono MoviOdds cron i nie zmieniono bankrolla, kuponów, wyników ani predykcji.


## Hotfix harmonogramu predykcji po hardeningu RPC — 2026-11-16
- Po odebraniu anon/authenticated bezpośredniego EXECUTE na `moneyball_cron_token_valid(text)` monitoring ujawnił, że `moneyball-predict` nadal weryfikował token przez REST z anon publishable key. To powodowało `Nieprawidłowy token harmonogramu` w cyklach 20:32–20:38 UTC. Błąd został powiązany czasowo i kodowo z migracją uprawnień; nie pozostawiono go bez naprawy.
- Zachowano bezpieczne REVOKE. Zmieniono `supabase/functions/moneyball-predict/index.ts`, aby weryfikacja helpera cron używała SERVICE_KEY zarówno jako apikey, jak i Bearer. Token nadal jest sprawdzany przez bazę; nie osłabiono uprawnień publicznych.
- Produkcyjna Edge Function `moneyball-predict` wdrożona bezpośrednio jako v218 ACTIVE, verify_jwt=false (dotychczasowe ustawienie zachowane), artefakt SHA `e15cce4c64dbcab0654afbbc1899f98fd214cec2614e93f5ba486a591642e8bb`.
- Kod zapisany w GitHub main: commit `e8fac33e91bd2be35ce087d7ce878d7a9706b033`. CI i kolejny cykl cron po v218 wymagają potwierdzenia; ostatnie logi pobrane bezpośrednio po deployu zawierały jeszcze tylko wywołania v217, które wystartowały przed wdrożeniem.
- Weryfikacja po wdrożeniu: sprawdzić kolejne wywołanie cron moneyball-predict (co minutę) — brak `Nieprawidłowy token harmonogramu`, status HTTP 200, rozpoczęcie/zakończenie skanu i brak błędów lease. Nie zamykać tego punktu do czasu logu v218.


## Potwierdzenie hotfixu cron i pierwszego cyklu Edge v71 — 2026-11-16 20:40 UTC
- Dodatkowa kontrola ujawniła drugi punkt zależny od uprawnień: wspólny helper `db()` w `moneyball-predict` przy `token===SERVICE_KEY` nadal wysyłał anon API key i poprzedni anon JWT. Dlatego v218 naprawił pierwszą walidację, ale nadal nie mógł wywołać chronionego `moneyball_cron_owner_id`; wywołanie 20:39 UTC zwróciło HTTP 500.
- Poprawiono helper `db()`: dla wywołań serwisowych wysyła teraz SERVICE_KEY jako apikey i Bearer; zwykłe sesje użytkowników nadal używają własnego JWT. Nie przywrócono EXECUTE dla anon/authenticated.
- Produkcyjna `moneyball-predict` v219: cron 20:40 UTC zwrócił HTTP 200 w 2.893 s; cron job #11 zakończony succeeded. Poprzedni błąd v218 nie powtórzył się w pierwszym wywołaniu v219. Kod źródłowy commit `08faec46abfdf41ac2bf02a0ebeee33ff5242a43`.
- Produkcyjna `moneyball-results-sync` v71: cron 20:40 UTC zwrócił HTTP 200 w 7.851 s; request summary: 79 fixtures fetched, 20 matches matched, 2 results saved, 26 predictions settled, 0 errors. Financial reconciliation: 5 checked, 0 reconciled, 0 failed, 75 ms.
- Pierwszy przebieg z lease wykonał jeszcze pełne sprawdzenie przełożeń: 2.233 s, 0 zmian. Następne przebiegi do 20:55 UTC powinny zwracać `skipped=true` i omijać siedem stron FootyNomad. To wymaga potwierdzenia na następnym cyklu.
- Alternatywne źródła: 0.672 s łącznie zamiast 1.237 s w poprzednim porównywalnym przebiegu; OpenLigaDB pominięty (brak niemieckich zaległych meczów), TheSportsDB pobrał tylko 2026-11-16. OpenMatchday nadal trwał 380 ms i nie zwrócił fixture rows. Nie twierdzić jeszcze, że cały sync jest szybszy — pojedynczy przebieg v71 trwał 7.851 s, a pełna seria porównawcza jeszcze nie istnieje.
- GitHub CI #841 i Cloudflare deploy #427 dla SHA `08faec46...` zakończone SUCCESS; wszystkie kroki, w tym Type-check Supabase Edge Functions, tests, build i Deploy to Cloudflare Workers, zakończone sukcesem.
- Health advisor: 0 findings. Security advisor pozostawia 3 anon-accessible SECURITY DEFINER RPC skanera z wymaganym tajnym tokenem; helpery tokena i trigger function pozostają niedostępne dla anon/authenticated. 5 tabel RLS/no-policy to worker-only/prywatne tabele, w tym nowy singleton lease.
- W żadnym z tych działań nie zmieniono rekordów bankrolla, kuponów, nóg kuponów ani ręcznie wprowadzonych wyników. Rozliczenie 5 kuponów w automatycznym reconciliation zakończyło się 0 zmianami.
- Nadal otwarte: potwierdzić kolejne wywołanie v219 bez 5xx; potwierdzić v71 `skipped=true` na cyklu 20:45/20:50; wykonać pełny E2E na realnym FT; zalogowany pomiar czasu menu wymaga zapisanej sesji profilu MAIN (obecnie profil nie ma potwierdzonego signed_in_site dla aplikacji).


## Zachowanie RLS po ukryciu helpera cron w schemacie private — 2026-11-16 20:42 UTC
- Audyt po hardeningu wykrył cztery istniejące polityki RLS (`match_market_data`, `match_results`, `matches`, `predictions`), które nadal wywoływały `public.moneyball_cron_owner_id`. Samo odebranie EXECUTE roli anon groziło błędem permission denied w tych politykach.
- Naprawiono to bez przywracania publicznego RPC: utworzono schemat `private` (nie jest schematem API PostgREST), funkcję `private.moneyball_cron_owner_id(text)` SECURITY DEFINER z pustym search_path i uprawnieniem EXECUTE tylko dla anon potrzebnym wewnętrznie przez RLS. Polityki RLS przełączono na helper private. Publiczny `moneyball_cron_owner_id` nadal nie jest wykonywalny przez anon/authenticated; service_role pozostaje uprawniony.
- Migracja produkcyjna `20261116204153_move_cron_owner_rls_helper_to_private_schema` zastosowana pomyślnie. Test RLS z rolą anon i nieprawidłowym tokenem zakończył się poprawnie: 0 widocznych rekordów, bez błędu uprawnień. Sprawdzone grants: anon nie ma EXECUTE na public helper, ma tylko niezbędne EXECUTE na private helper; authenticated nie ma dostępu do private helper.
- Security advisor nie zgłasza już publicznego `moneyball_cron_owner_id`; pozostały 3 cron RPC z walidacją sekretnego tokenu, 5 worker-only tabel RLS/no-policy, pg_net w public oraz wyłączona ochrona haseł przed wyciekami. Nie rozszerzać uprawnień tych tabel.
- Zmiana źródłowa zapisana w GitHub main: `supabase/migrations/20261116204153_move_cron_owner_rls_helper_to_private_schema.sql`, commit `935a8913f6edcf2c8ae874764a7db168c0f40d37`. CI/Cloudflare dla tego commita wymagają sprawdzenia.
- Nie zmieniono wyników, predykcji, kuponów, nóg kuponów ani bankrolla.


## Potwierdzenie wznowienia skanu i mierzalnej optymalizacji results-sync — 2026-11-16 20:45 UTC
- Produkcyjna migracja `20261116204304_restrict_prediction_scheduler_rpcs_to_service_role` odebrała PUBLIC/anon/authenticated EXECUTE na `moneyball_claim_prediction_scan`, `moneyball_finish_prediction_scan`, `moneyball_prediction_scan_page`; przywrócono EXECUTE tylko dla service_role. Po zmianie potwierdzono: anon=false, authenticated=false, service_role=true dla wszystkich trzech RPC.
- Security advisor po tej zmianie: 0 funkcji SECURITY DEFINER wykonywalnych anonimowo; health advisor: 0 findings. Pozostałe security findings to 5 worker-only tabel RLS/no-policy (INFO), pg_net w public (WARN) i wyłączona ochrona haseł przed wyciekami (WARN). Nie przenosić pg_net bez osobnego audytu cron jobs.
- Produkcyjny `moneyball-predict` v219 po wygaśnięciu starego lease wznowił skan 20:45 UTC. HTTP 200, odpowiedź `net._http_response` ID 2938. Stan skanu: `completed`, 1 batch, 8 fixtures processed, 0 błędów, następny termin 21:00:12 UTC. Wygenerowano 96 wierszy rynkowych; 9 pending rows zaktualizowano, 87 zachowano, 0 utworzono, 0 kuponów utworzono. Pokrycie źródłami było 0/8 i 8 meczów oznaczono jako brakujące; 0 typów WYBRANY. To prawidłowy fail-safe — nie tworzyć typów ani kuponów przy braku danych.
- Produkcyjny `moneyball-results-sync` v71 w tym samym cyklu zwrócił HTTP 200 w 4.769 s. Porównywalny przebieg v68 o 20:35 UTC trwał 6.125 s — pojedynczy pomiar v71 jest o 1.356 s (22.1%) krótszy; nie traktować jeszcze jako stabilnej średniej.
- W przebiegu v71: reschedule reconciliation zostało pominięte w 37 ms (`skipped=true`) zamiast pełnego przebiegu 2.233 s; alternatywne źródła trwały 453 ms wobec wcześniejszych 1.237 s; OpenLigaDB pominięty bez niemieckich zaległych meczów. Wyniki: 2 zapisane/odświeżone, 26 prognoz rozliczonych, 0 błędów; financial reconciliation 5 kuponów sprawdzonych, 0 zmian i 0 błędów.
- Repo main: migration `20261116204304_restrict_prediction_scheduler_rpcs_to_service_role.sql`, commit `958074ce60e633649778f31175495fe7157e1ac5`. CI #845 SUCCESS i Cloudflare Worker deploy #431 SUCCESS.
- Nie zmieniono bankrolla ani rekordów kuponów/nóg. Automatyczny skan nie utworzył kuponów, bo żaden z 8 meczów nie miał wystarczającego pokrycia i progu WYBRANY.
- Pozostałe priorytety: poprawić pokrycie historii dla dzisiejszych 8 meczów (GitHub public competitions=0; cache FootyNomad/FotbalInfo=0), monitorować serię wyników v71 i kolejny skan po 21:00 UTC, wykonać E2E na rzeczywistym FT, oraz pomiar czasu menu po zapisaniu profilu MAIN (obecnie brak potwierdzonej sesji dla domeny aplikacji).


## Harmonogram automatycznego skanu predykcji 08:00 / 15:00 Europe/Brussels — 2026-11-16
- Wcześniejszy audyt wykazał, że po ukończeniu pełnego dziennego skanu `moneyball_finish_prediction_scan` ustawiał `next_scan_at = now()+15min`, co powodowało niepotrzebne ponawianie pełnego skanu co 15 minut, także późnym wieczorem. To nie odpowiadało ustaleniu z poprzednich czatów: skan rano 08:00 i ponowny o 15:00 czasu belgijskiego.
- Zmieniono `public.moneyball_finish_prediction_scan`: jeśli `p_has_more=true`, lease jest zwalniany i kolejna partia może ruszyć od następnego cron tick (co minutę); jeśli `p_has_more=false`, `next_scan_at` ustawiany jest na najbliższe 08:00 lub 15:00 w strefie `Europe/Brussels`. Po 15:00 następny termin to 08:00 kolejnego dnia. Wyniki i synchronizacja meczów pozostają co 5 minut — ta zmiana dotyczy tylko pełnego skanu predykcji.
- Migracja produkcyjna `20261116204659_schedule_prediction_scans_at_08_and_15_brussels` zastosowana pomyślnie. Test granic harmonogramu: 07:00 -> 08:00 dziś; 08:00 -> 15:00 dziś; 14:59 -> 15:00 dziś; 15:00 -> 08:00 jutro; 21:45 -> 08:00 jutro.
- Stan bieżącego skanu 2026-11-16 zaktualizowano bez zmiany prognoz: status `completed`, następny termin `2026-11-17 07:00 UTC` (=08:00 Europe/Brussels). Eliminuje to niepotrzebne kolejne skanowanie 22:00 lokalnie.
- Kod migracji zapisany w GitHub main: `supabase/migrations/20261116204659_schedule_prediction_scans_at_08_and_15_brussels.sql`, commit `7ee157e2c36d16fd221818345f78a522b0153459`. CI/Cloudflare runy dla tego commita wymagają sprawdzenia.
- Nie zmieniono wyników, prognoz, kuponów, nóg kuponów ani bankrolla. Pełne batch continuation zachowuje dotychczasowy mechanizm.
- Test produkcyjny po migracji: kolejny tick cron powinien zwrócić cooldown/skip do 08:00 CET; trzeba potwierdzić w logach. Kolejny pełny skan o 08:00 CET następnego dnia powinien zacząć nową datę i batch.


## Potwierdzenie harmonogramu i kolejnego cyklu wyników — 2026-11-16 20:50 UTC
- Po aktualizacji stanu skanu i migracji harmonogramu, wywołania cron `moneyball-predict` o 20:48 i 20:49 UTC zwróciły HTTP 200, `skipped=true`, `reason=cooldown`, `next_scan_at=2026-11-17T07:00:00Z` (08:00 Europe/Brussels). Potwierdzono brak niepotrzebnego wieczornego skanowania; następne pełne skanowanie ma ruszyć jutro o 08:00 CET.
- Results-sync v71 o 20:50 UTC zwrócił HTTP 200. Odpowiedź: 2 wyniki zapisane/odświeżone, 26 predykcji rozliczonych, 5 kuponów sprawdzonych, 0 zmian finansowych, 0 błędów. Wynik z odpowiedzi pg_net ID 2944.
- GitHub CI #848 i Cloudflare Worker deploy #434 dla SHA `645c05b9663eb04869a8e8964cb668a6572e23ea` zakończone SUCCESS. Deploy zawiera aktualny stan gałęzi main z migracją harmonogramu.
- Read-only precheck dla 2026-11-17: 2 mecze kwalifikujące się do zakresu 1./2. ligi; oba FootyNomad z numerycznymi external_id i przyszłym kickoffem. Brak cache FootyNomad/FotbalInfo przed skanem — oba kwalifikują się do ograniczonego pobrania formy w jutrzejszej partii. Nie uruchamiano skanu przed zaplanowanym czasem.
- Aktualny status: synchronizacja wyników co 5 minut działa; skan predykcji ma dwa dzienne okna 08:00 i 15:00 Europe/Brussels, batch continuation co minutę tylko gdy jest więcej wyników. Cron MoviOdds pozostaje wyłączony.


## Drugi pomiar po optymalizacji results-sync v71 — 2026-11-16 20:50 UTC
- Drugi przebieg produkcyjny v71 zakończony HTTP 200 w 4.210 s; zero błędów. Wyniki: 2 zapisane/odświeżone, 26 predykcji rozliczonych, 5 kuponów sprawdzonych, 0 zmian finansowych.
- Reschedule lookup ponownie pominięty: 62 ms; alternatywne źródła 481 ms; OpenLigaDB pominięty, ESPN i TheSportsDB zwróciły dane, OpenMatchday 0 feed rows.
- Dwa przebiegi po zmianie: 4.769 s i 4.210 s (średnia 4.490 s), wobec pojedynczego baseline v68 6.125 s — średnio ok. 26.7% krócej. To wstępny pomiar z dwóch cykli, nadal monitorować kolejne 5-minutowe uruchomienia.
- Harmonogram predykcji o 20:50 ponownie zwrócił HTTP 200 cooldown z `next_scan_at=2026-11-17T07:00:00Z`; stan pozostaje completed, lease null. Nie uruchomiono dodatkowego skanu.


## Audyt regresji po poprawce tokenu i timeoutów bazy — 2026-11-16 20:52 UTC
- Przegląd logów Edge Function od 20:30 do 20:52 wykazał 8 HTTP 5xx dla `moneyball-predict`; wszystkie przypadają na okno przed pełnym hotfixem v219 (nieprawidłowy token / brak uprawnienia helpera owner). Po wdrożeniu v219 o 20:40 wszystkie późniejsze wywołania obserwowane do 20:50 zwracały HTTP 200; brak nowego 5xx po naprawie.
- `moneyball-results-sync`: 5 wywołań w badanym oknie, 0 HTTP 5xx. Dwa ostatnie przebiegi v71: 4.769 s i 4.210 s.
- PostgreSQL: od 12:36:27 UTC do 20:52 UTC nie odnotowano nowego statement timeout; 4 widoczne timeout events w szerszym oknie pochodzą z 12:36 i wcześniejszego problemu z pełnymi skanami predictions.
- Health advisor nadal 0 findings. To potwierdza brak nowych timeoutów i 5xx po hotfixie w obserwowanym oknie, ale monitorowanie pozostaje aktywne.


## Aktualizacja postępu i weryfikacja MAIN — 2026-11-16 21:53 CET
- Potwierdzono zakończenie najnowszych workflow dla commit `ca01c02d9e664597eeb94bce41439ef4febe0f51`: GitHub CI #851 SUCCESS oraz Cloudflare Workers deploy #437 SUCCESS. Wszystkie kroki validate: Deno Edge type-check, tests, TS type-check, build; deploy: Deno, tests, TS, Cloudflare build i Deploy to Cloudflare Workers — SUCCESS.
- Publiczna strona produkcyjna `/` ponownie zwróciła MONEYBALL GLOBAL 2.0, polski opis i stawkę analityczną 4 €; obserwowana latencja fetch 315 ms. `/panel` prawidłowo wymaga zalogowania (login_required).
- Publiczna `/login` zwróciła prawidłowy formularz logowania, ale obserwowane czasy fetch wyniosły 5.096 s oraz 3.118 s w kolejnej próbie; trzecia próba zakończyła się timeoutem narzędzia pobierającego. Nie jest to jeszcze wiarygodny pomiar RUM ani dowód, że sam ekran jest przyczyną wolnego menu. Nie zmieniono z tego powodu bez dowodu konfiguracji fontów, auth ani bundle.
- Potwierdzono brak zapisanej sesji MAIN w profilu przeglądarki `prof_bb80729b439c4bb0`: profil istnieje, ale `signed_in_sites=[]`, `domain_count=0`. Nie wykonano logowania ani nie pobierano/nie proszono o hasło. Bez autoryzowanej sesji nie można rzetelnie zmierzyć przejść menu, widoków panelu i rzeczywistych zapytań aplikacji.
- Statyczny audyt routingu: `src/router.tsx` ma `defaultPreload: "intent"`, `defaultPreloadDelay: 0`, `defaultPreloadStaleTime: 120_000`; menu `AppShell` ma `preload="intent"`. `History`, `Results`, `PredictionsView`, `Coupons` i `Matches` używają już scoped/paginowanych zapytań; import CSV odracza pełne archiwum do otwarcia dialogu.
- Pozostały znane pełnozakresowe odczyty: `fetchStatisticsPageData` ładuje pełną historię meczów, aktywne prognozy dla wszystkich meczów w zakresie i kupony/nogi (potrzebne obecnie do pełnych przekrojowych statystyk); `bankroll.tsx` korzysta z `useTable(bankroll_transactions)` i `useTable(coupons)` (bieżący rozmiar ledgeru był mały: 7 transakcji/9 kuponów w poprzednim odczycie). `cancelCoupon`, `reconcileCouponLedger` i `rebuildBalances` pobierają pełny ledger podczas mutacji; nie są wykonywane przy zwykłym wejściu na każdą stronę.
- Nie wdrażano w tej sesji eksperymentalnego refaktoru statystyk ani zmian logowania, ponieważ brak wiarygodnego RUM i pełnej specyfikacji zachowania mogłyby naruszyć poprawność historycznych statystyk/rozliczeń. Kolejny bezpieczny krok to pomiar po zalogowaniu i dopiero wtedy paginacja/lazy-load tych widoków.
- Health advisor: nadal 0 findings. Ostatni obserwowany cron moneyball-predict o 20:54 UTC: HTTP 200, 1.981 s; poprzednie 20:50–20:53 również HTTP 200. Results-sync v71 ostatnie dwa potwierdzone cykle HTTP 200, 4.769 s i 4.210 s, bez błędów.
- Stan trwały projektu: `MONEYBALL GLOBAL MAIN` only, repo `damianwalus3-jpg/moneyball-global`, branch `main`, produkcja Cloudflare Workers + istniejący Supabase. Nie używać TEST, Vercel ani Lovable; nie zmieniać historycznych finansów ręcznie; stawka kuponu pozostaje 4 €; skan Europy główne ligi + 1./2. poziom o 08:00 i 15:00 Europe/Brussels; synchronizacja wyników co 5 min.
- Otwarta blokada do pełnego testu: użytkownik musi zalogować się do MAIN w przygotowanym profilu przeglądarki (nie wysyłać hasła na czacie). Profil setup URL był przekazany wcześniej; brak potwierdzenia zapisanej sesji. Pełny E2E rozliczenia nadal wymaga rzeczywistego FT dla kuponu z zapisanymi nogami; nie wolno tworzyć sztucznego wyniku tylko dla testu.


## Dodatkowa kontrola wyników i księgi — 2026-11-16 20:55–20:57 UTC
- Results-sync v71 o 20:55 UTC: HTTP 200, 5.583 s; 79 fixtures pobranych, 20 dopasowanych, 2 wyniki zapisane/odświeżone, 26 prognoz rozliczonych, 0 coupon legs do rozliczenia, 0 błędów. Alternatywne źródła 14 fetched / 13 matched. Kontrola przełożeń pominięta (`skipped=true`) w 165 ms. Financial reconciliation: 5 kuponów sprawdzonych, 0 zmian, 0 błędów.
- Cron predykcji 20:55, 20:56, 20:57: HTTP 200, `skipped=true`, `reason=cooldown`, następny skan `2026-11-17T07:00:00Z` (=08:00 Europe/Brussels). Stan completed, lease null.
- PostgreSQL logs 20:50–20:57 UTC: brak statement timeout ani canceling statement.
- Ponowny odczyt ledgeru (read-only): deposit 1 / 91.60 €, stake 5 / 23.00 €, return 1 / 5.25 €; saldo wynikające z zapisanych transakcji = 73.85 €. Nie zmieniano ledgeru, kuponów ani stawek.
- Results-sync v71 kolejne próbki: 4.769 s, 4.210 s, 5.583 s; średnia 4.854 s wobec pojedynczego baseline v68 6.125 s (wstępnie ok. 20.8% krócej). Wniosek: stabilny trend wymaga większej liczby pomiarów; nie używać już wyłącznie dwóch pierwszych próbek jako jedynej średniej.


## Kontynuacja napraw MAIN — potwierdzenie deploy #439 i kontrola zakresu — 2026-11-16 22:15 CET
- Commit dokumentacyjny `0b8fec12ec4844de4f801421532c48a7a50642dc`: GitHub CI #853 SUCCESS (Deno Edge type-check, testy, TypeScript, build) oraz Cloudflare Workers deploy #439 SUCCESS (Cloudflare build + Deploy to Cloudflare Workers). Najnowszy zapis repo jest opublikowany na produkcji MAIN.
- Ponownie otwarto produkcyjny Worker: root, /login zwracają prawidłową stronę MONEYBALL GLOBAL 2.0; /panel bez sesji zwraca login_required. Narzędzie fetch mierzyło zmienne opóźnienia ekstrakcji: root 3.17 s, login 4.04 s. To nie jest RUM/przeglądarkowy czas interaktywności, więc nie uznawać tego za wiarygodny pomiar menu.
- Próba uruchomienia przeglądarkowego pomiaru RUM nie wystartowała, bo konto TinyFish ma saldo 0 USD. Nie doładowywać i nie używać płatnej usługi bez wyraźnej zgody; kontynuować pomiar po zalogowaniu tylko jeśli użytkownik sam udostępni/aktywuje profil MAIN. Profil `prof_bb80729b439c4bb0` nadal ma `signed_in_sites=[]`, `domain_count=0`; brak autoryzowanej sesji. Nie prosić o hasło na czacie.
- Kontrola zakresu meczów na 17.11 przez produkcyjny helper `public.moneyball_is_european_top_two_league(country, competition)`: dokładnie 2 mecze kwalifikują się do zakresu — Warrenpoint Town–Glenavon FC i Rathfriland–Moyola Park (Northern Ireland Championship), oba scheduled i bez predykcji przed skanem. Pozostałe surowe rekordy FootyNomad na 17.11 obejmują młodzież, rezerwy, puchary i niższe ligi; nie przechodzą filtra. Frontend `mecze.tsx` również filtruje przez `isEuropeanTopTwoLeague`. Nie usuwać historycznych/źródłowych rekordów z bazy, ponieważ to nie wpływa na widok użytkownika i może uszkodzić deduplikację/śledzenie źródeł.
- Wyniki 16.11: kupon TEST #1 ma 2 nogi won i Gibraltar–Malta pending/live; TEST #2 ma 1 nogę won i Greece–Serbia oraz Switzerland–Scotland pending/live. Kupony po 4 € pozostają pending, zgodnie z logiką 3 nóg. Wyniki 365Scores/UEFA w czasie kontroli nadal nie dostarczyły wiarygodnego FT dla tych trzech spotkań; nie wymuszać statusu ani wypłaty.
- Results-sync v71: ostatnie widoczne próbki 21:00 UTC 9.277 s, 21:05 UTC 4.847 s, 21:10 UTC 6.754 s; wszystkie HTTP 200. Przebieg 21:10 pobrał 79 fixture, dopasował 20, zapisał 2 wyniki, rozliczył 26 predykcji, 0 legs i 0 errors; 5 kuponów sprawdzonych, 0 zmian. Cron predykcji co minutę HTTP 200 w 21:01–21:14; stan completed, lease null, next scan 2026-11-17 07:00 UTC = 08:00 Brussels.
- Harmonogramy pg_cron potwierdzone aktywne: FootyNomad feed co 15 min, results-sync co 5 min, sequential prediction co minutę; odds sync co 15 min pozostaje nieaktywny zgodnie z wcześniejszym stanem. Nie zmieniać tego bez odrębnego audytu.
- Supabase health advisor: 0 findings. Security advisor nadal raportuje 5 tabel z RLS bez polityk (worker-only, oczekiwane), pg_net w public schema (nie przenosić bez migracji/zgodności z cron), oraz wyłączoną ochronę przed wyciekłymi hasłami. Nie wprowadzono zmian auth/extension w ciemno.
- Read-only ledger nadal: deposit 91.60 €, stakes 23.00 €, returns 5.25 €, saldo 73.85 €. Brak nowych/duplikowanych wpisów.
- Otwarta blokada na zielone światło: rzeczywisty pomiar menu po zalogowaniu i rzeczywisty settlement E2E po FT dla istniejącego kuponu. Kod/CI/deploy i automaty cron działają; nie oznaczać tych dwóch testów za wykonane bez danych.


## Hardening uprawnień tabel worker-only — 2026-11-16 22:17 CET
- Audyt `information_schema.role_table_grants` wykazał, że mimo RLS bez polityk pięć tabel wewnętrznych miało nadal jawne GRANT-y dla `anon` i `authenticated`. RLS odrzucał zapytania bez polityk, ale pozostawione granty były zbędną powierzchnią dostępu.
- Zastosowano produkcyjną migrację `20261116211700_revoke_browser_access_to_worker_internal_tables`: REVOKE ALL dla anon/authenticated z `match_result_sources`, `moneyball_password_recovery`, `moneyball_prediction_scan_state`, `moneyball_reschedule_sync_state`, `project_work_log`; service_role zachował SELECT/INSERT/UPDATE/DELETE.
- Po migracji ponowny odczyt `information_schema.role_table_grants` potwierdził brak jakichkolwiek grantów dla anon/authenticated na tych pięciu tabelach; service_role zachował dostęp. Health advisor nadal 0 findings. Security advisor nadal zgłasza wyłącznie INFO dla RLS/no-policy (5 tabel — teraz zgodne z zamierzonym worker-only), WARN pg_net w public schema i WARN leaked password protection disabled. pg_net nie przenoszono, aby nie naruszyć istniejących funkcji `net.http_*` i cronów.
- Migracja SQL została zapisana w repo `supabase/migrations/20261116211701_revoke_browser_access_to_worker_internal_tables.sql`, odpowiada wersji migracji Supabase `20261116211701`; commit z finalną nazwą pliku `f4ae1dc5b1c347dc23dc49d4e058a5381e8916d9`. Pierwszy commit z plikiem o wersji `...1700` został skorygowany, aby nazwa dokładnie odpowiadała wersji zastosowanej przez Supabase. Po migracji cron predict i free-feed zwróciły HTTP 200, brak grantów browser-role potwierdzony; service_role zachował dostęp.
- Nie zmieniano danych meczów, prognoz, kuponów ani bankrolla.


## Nieblokujące ładowanie widoku Statystyki — 2026-11-16 22:22 CET
- Audyt wykazał, że loader route `/statystyki` blokował nawigację na pobraniu całej historii: wszystkie mecze, kupony, nogi kuponów i aktywne prognozy z kwalifikujących się lig. Jest to jeden z najcięższych widoków i nie powinien blokować wejścia ani renderowania powłoki aplikacji.
- Commit `a524b268e371d40e8ac07802e01108083c3ebda6`: usunięto synchroniczny `ensureQueryData` z loadera statystyk; komponent używa zwykłego `useQuery`, pokazuje nagłówek i loader w treści podczas pobierania, a przy błędzie wyświetla istniejący `DataError` z retry. Agregacje, filtry, pełna historia, ROI, Brier/Log Loss i dane finansowe pozostają bez zmian — to wyłącznie zmiana momentu ładowania.
- GitHub CI #860 SUCCESS (Deno check, tests, TypeScript, build). Cloudflare Workers deploy #446 SUCCESS (Cloudflare build + deploy). Produkcyjny Worker po publikacji zwrócił stronę główną MONEYBALL GLOBAL 2.0; ekstrakcja root 173 ms. `/login` nadal zwraca prawidłowy formularz; jej czas ekstrakcji 3.50 s nie jest pomiarem RUM i nie może być uznany za czas ładowania UI.
- Pełny pomiar interakcji menu i prywatnego widoku statystyk nadal wymaga zalogowanej sesji MAIN. Nie deklarować poprawy procentowej bez RUM; potwierdzony efekt kodowy to brak blokowania nawigacji przez loader statystyk.
- Zmiana nie dotyka Supabase, wyników, kuponów, stawek, bankrolla ani historii.


## Naprawa zakresu meczów UEFA Nations League — 2026-11-16
- Zgłoszenie użytkownika na podstawie zrzutu ekranu: lista meczów nie pokazywała UEFA Nations League mimo trwającej kolejki; zachować europejskie ligi krajowe poziomu 1 i 2, wykluczać poziom 3 i niższe.
- Diagnoza z produkcyjnej bazy dla 16.11.2026: rekordy UEFA Nations League były zapisane, lecz 9 spotkań miało `country='World'` i odpadało z filtra wymagającego europejskiego kraju oraz ligi krajowej top-two. Osobny mecz z `country='North Macedonia'` przechodził. W chwili audytu 9 rekordów World obejmowało 5 FT i 4 LIVE.
- Niezależna kontrola FootyNomad: strona dzienna podawała 79 meczów, w tym sekcję UEFA Nations League z 10 spotkaniami; UEFA potwierdzała kolejkę 16.11 oraz kontynuację 17.11. Źródła: https://footynomad.com/list oraz https://www.uefa.com/uefanationsleague/news/02a2-1fea18abbcbc-456e846509e7-1000--2026-27-uefa-nations-league-all-the-league-phase-fixtures-a/
- Naprawa: dokładny wyjątek dla `UEFA Nations League*` niezależny od kraju dostawcy, bez rozszerzania na UEFA U21/U19, puchary, kobiece rozgrywki, ligi trzeciego poziomu ani rozgrywki spoza Europy. Zachowano dotychczasową krajową allowlistę top-two.
- Frontend/domain: `src/lib/domain.ts` i testy `src/lib/domain.test.ts`; testy obejmują Nations League (w tym wariant nazwy), UEFA U21 Qualification, Persha Liga, Druha Liga, Serie C i Premier League Cup.
- Ingestion/prediction: poprawiono `supabase/functions/footynomad-sync/index.ts`, `moneyball-free-feed/index.ts`, `moneyball-predict/index.ts`; deployed produkcyjnie odpowiednio v66, v23, v221.
- Baza: migracje `20261116230000_include_uefa_nations_league_in_european_scope` oraz `allow_uefa_nations_league_competition_variants`; funkcja `public.moneyball_is_european_top_two_league` uwzględnia Nations League mimo `country='World'`.
- Test SQL po wdrożeniu: World/UEFA Nations League=true; World/UEFA Nations League - League B=true; World/UEFA U21 Championship - Qualification=false; Ukraine/Persha Liga=true; Ukraine/Druha Liga=false; Italy/Serie C=false. North Macedonia/UEFA Nations League również true.
- Otwarte: potwierdzić następny produkcyjny feed GET i ręczny/cron skan predykcji dla bieżącej daty, następnie zweryfikować ekran Mecze po odświeżeniu i CI/Cloudflare deploy. Nie deklarować końcowego zielonego światła przed tymi testami.

## Rozszerzenie europejskiego zakresu lig — 2026-11-16
- Kontynuacja audytu potwierdziła drugi problem: allowlisty nazw lig w footynomad-sync, moneyball-free-feed, moneyball-predict i frontendowym src/lib/domain.ts nie obejmowały wielu prawidłowych nazw drugiego poziomu, m.in. Austrian 2. Liga, Eerste Divisie, TFF First League, I Liga, Liga II, Challenge League, Esiliiga, Ykkosliiga, Liga Portugal 2 oraz czeskie FNL.
- Poszerzono wzorce we wszystkich czterech warstwach; zachowano wykluczenia lig trzeciego poziomu i niższych, pucharów, rozgrywek młodzieżowych, kobiecych, rezerw i B-teamów. UEFA Nations League pozostaje osobnym wyjątkiem, niezależnym od kraju World.
- Zaktualizowano produkcyjną funkcję SQL moneyball_is_european_top_two_league; migracje expand_european_top_two_league_coverage, repair_european_top_two_filter_and_alias_coverage oraz add_czech_fnl_second_tier_alias zastosowane.
- Test SQL po ostatniej migracji: 17/17 przypadków PASS, w tym aliasy drugiego poziomu, wykluczenie League One (poziom 3), Serie C, 3. Liga, Druha Liga, UEFA U21 i zachowanie UEFA Nations League.
- Edge Functions wdrożone: footynomad-sync v67, moneyball-free-feed v24, moneyball-predict v222.
- Zmiany kodu zapisane w main; commity: 7cdda4996cd7c69e98976b6e57b318dadd5b2bed, 89afe7e3ebb330955d62d8d51560fc23a2a9a642, 81f26034f50349818d5c45b6106687e958ac0f73, f2265e833271f86e827f106abe386c4cb889921d. Testy regresyjne src/lib/domain.test.ts; commit 853b909706632c50752a164d75f69367754f13f8.
- Uwaga: weryfikacja SQL na aktualnych zapisanych meczach dnia 16.11 nadal widzi tylko rozgrywki, które są już w tabeli; sama zmiana filtra nie pobierze brakujących rekordów z upstream. Następny obowiązkowy test to pełny ponowny import FootyNomad + porównanie z listą źródłową, a następnie CI/Cloudflare deploy aplikacji. Nie ogłaszać pełnego pokrycia Europy do czasu porównania surowej listy FootyNomad z importem.
## Dalsze rozszerzenie zakresu lig i filtr rezerw — 2026-11-16 (kontynuacja)
- Dodano dalsze lokalne nazwy lig dla UEFA associations (m.in. Primera Divisio, National Division, Besta deild, Meistaradeildin, Super Liga, Premijer Liga, Prva Makedonska) do frontendowego domain.ts i trzech Edge Functions: footynomad-sync, moneyball-free-feed, moneyball-predict.
- Naprawiono istotny błąd pierwszeństwa operatorów w SQL moneyball_is_european_top_two_league: wcześniej warunek kraju mógł przepuszczać rozgrywki trzeciego poziomu mimo negatywnej allowlisty. Obecnie warunek kraju/UEFA jest grupowany osobno, a wykluczenia poziomów niższych, pucharów, youth i kobiet stosowane są do wszystkich.
- Ostateczny test SQL: 24/24 PASS. Pozytywne aliasy drugich lig (Austrian 2. Liga, Eerste Divisie, TFF First League, I Liga, Liga II, Challenge League, FNL, 1. Division, Esiliiga, Ykkosliiga, Liga Portugal 2, Primera Divisio, National Division, Besta deild, Meistaradeildin, Super Liga, First League, Albanian Superliga); negatywne: League One, 3. Liga, Serie C, Druha Liga, UEFA U21. UEFA Nations League PASS.
- Dodano funkcję frontendową isEligibleEuropeanMatch: ekran Mecze odrzuca teraz kobiece i jawnie nie-męskie rekordy oraz rezerwy/B-teamy (w tym końcówki II/III/B). To usuwa m.in. Polissya II z listy głównej. Import FootyNomad i free-feed odrzucają te zespoły już przed zapisem/enrichment.
- Ostateczne wdrożone wersje Edge Functions: footynomad-sync v70, moneyball-free-feed v27, moneyball-predict v224.
- Aktualny odczyt tabeli dla 16.11: 33 surowe mecze w bazie; 19 przechodzi kwalifikację ligi i płci; 17 po dodatkowym prostym wykluczeniu nazw II/III/B. Frontend ma dodatkowo jawne aliasy rezerw Celta Fortuna i innych B-teamów. Ten odczyt nie jest dowodem pełnej kompletności upstream — wymaga porównania pełnej listy FootyNomad.
- Status Cloudflare frontendu: NIEPOTWIERDZONY. GitHub combined status dla najnowszego commitu pokazuje wyłącznie stary Vercel failure (build-rate-limit); nie ma potwierdzonego Cloudflare check/deploy w dostępnych statusach. Nie wdrażać ani nie przywracać Vercel. Przed uznaniem naprawy ekranu za zakończoną sprawdzić Cloudflare Worker version i rzeczywisty zalogowany ekran Mecze.
- Zmiany kodu, testów i dokumentacji pozostają na branch main. Nie ogłaszać pełnego zielonego światła przed Cloudflare deploy + authenticated UI smoke test + ponownym skanem porównanym z pełnym terminarzem FootyNomad.
## Dalsze rozszerzenie europejskich lig i poprawki CI — 2026-11-16
- Kontynuowano rozszerzenie aliasów pierwszych i drugich lig w czterech warstwach: footynomad-sync, moneyball-free-feed, moneyball-predict oraz frontend src/lib/domain.ts. Dodano m.in. nazwy lig krajowych w Bałkanach, Islandii, Ukrainie i innych federacjach, w tym Persha Liga.
- Weryfikacja GitHub Actions wykazała rzeczywistą regresję: Persha Liga była już dopuszczona w backendzie, ale brakowało jej w allowliście frontendu; test CI wskazał src/lib/domain.test.ts:73. Poprawiono frontend i dodano przypadek regresyjny.
- Audyt wykazał, że ogólne dopasowanie 'premier league' wpuszczało angielską Premier League 2 (rozgrywki rozwojowe). Dodano jawne wykluczenie 'Premier League 2', 'PL2' i 'Professional Development League' w filtrach frontend/backend/predykcje oraz funkcji SQL.
- Funkcja SQL moneyball_is_european_top_two_league została zsynchronizowana z aliasem Persha Liga i wykluczeniem Premier League 2. Test SQL: 22/22 przypadków PASS; przykłady obejmują 2. poziom z Austrii, Holandii, Turcji, Polski, Rumunii, Szwajcarii, Czech, Danii, Estonii, Finlandii, Portugalii, Ukrainy, Albanii, Islandii oraz UEFA Nations League; odrzuca League One, Premier League 2, 3. Liga, Serie C, Druha Liga, puchary i UEFA U21.
- Produkcyjne Edge Functions po finalnych poprawkach: footynomad-sync v72, moneyball-free-feed v29, moneyball-predict v226 — ACTIVE.
- Uwaga: CI dla wcześniejszego commitu 1f3d0173 oblało test Persha Liga; to zostało zdiagnozowane i poprawione. Nie traktować tego starego wyniku jako aktualnego. Obowiązkowo sprawdzić CI i Cloudflare deploy dla commitów po poprawce. Nie ogłaszać pełnego pokrycia terminarza, dopóki surowy import FootyNomad nie zostanie porównany z bazą i listą lig.
## Zakres tylko lig krajowych + porównanie FootyNomad — 2026-11-16
- Doprecyzowano scope zgodnie z wymaganiem: skan obejmuje WYŁĄCZNIE europejskie krajowe ligi seniorów, poziom 1 i 2. Wyłączono wyjątek UEFA Nations League oraz pozostałe rozgrywki reprezentacyjne/międzynarodowe; U20/U21, puchary, kobiety, rezerwy i drużyny B pozostają poza listą.
- Wdrożono tę regułę w frontendzie, footynomad-sync, moneyball-free-feed i moneyball-predict. Funkcja SQL moneyball_is_european_top_two_league nie dopuszcza już kraju World przez wyjątek UEFA Nations League.
- Produkcyjny test SQL po zmianie: 23/23 PASS. Testy obejmują nazwy drugich lig w Austrii, Holandii, Turcji, Polsce, Rumunii, Szwajcarii, Czechach, Danii, Estonii, Finlandii, Portugalii, Ukrainie, Albanii i Islandii oraz wykluczają League One, Premier League 2, Serie C, 3. Liga, Druha Liga, UEFA Nations League, UEFA U21 i puchary.
- Źródło FootyNomad 2026-11-16: strona dzienna podaje 78 meczów w 25 krajach. Publiczny parser europejski zwrócił 31 rekordów, ale obejmowały one także Nations League, U20/U21, Frauen Bundesliga, Serie C i rozgrywki niższych poziomów — nie wolno ich utożsamiać z kwalifikującymi się ligami. Po regułach scope i wykluczeniu B-teamów kwalifikują się 8 meczów krajowych seniorów w tym dniu (Grecja SL2: 2, Kosovo Liga E Pare: 1, Serbia Prva Liga: 2, Słowacja 2. liga: 1, Ukraina Persha Liga: 2).
- W bazie nadal istnieją historyczne/już zaimportowane rekordy odrzucone przez nowy filtr, m.in. Celta Fortuna/Celta de Vigo II, Olympiakos Piraeus II i Polissya II. Nie usuwaj ich z bazy; frontend i model mają je wykluczać. Nie wszystkie surowe rekordy muszą zostać fizycznie usunięte.
- GitHub Actions CI dla commitu 1d74796d zakończyło się SUCCESS (run 921); CI dla commitu c7e5e85e (run 922) zakończyło się SUCCESS po sprawdzeniu. Cloudflare deploy run 508 dla c7e5e85e był jeszcze pending w ostatnim odczycie — wymaga ponownego sprawdzenia i nie wolno deklarować wdrożenia MAIN, dopóki nie będzie SUCCESS.
- Produkcyjne Edge Functions po finalnych zmianach: footynomad-sync v73, moneyball-free-feed v30, moneyball-predict v227 — ACTIVE.
- Otwarty test po wdrożeniu: porównać wynik pełnego sync FootyNomad z surową listą i zweryfikować, że rekordy kwalifikujące się są widoczne na ekranie Mecze; lista jest zawsze tylko na dzisiejszą datę Europe/Brussels.
## Porządkowanie migracji i trwały zapis stanu — 2026-11-16
- Zapisano końcowy stan prac również w public.project_work_log (id=10) oraz w tym dzienniku repozytorium, aby nie powtarzać tych samych napraw.
- Uporządkowano pliki migracji w repozytorium: dodano pliki z wersjami odpowiadającymi faktycznie zastosowanym migracjom 20261116215604, 20261116221414, 20261116221549 i 20261116221734. Usunięto późniejsze, błędnie nazwane duplikaty, w tym stary plik 20261116230000, który mógł ponownie włączyć Nations League i złamać zakres lig krajowych.
- Najnowszy stan repozytorium MAIN po synchronizacji migracji: commit 5c3cb856436a110befa0fcf91851948f3df0448c. Po tej zmianie trzeba sprawdzić nowy CI i Cloudflare deploy; starszy CI 922 dla poprzedniego commitu był SUCCESS, ale nie jest potwierdzeniem deployu najnowszego commitu.
## Potwierdzenie produkcyjnego deployu po rozszerzeniu lig — 2026-11-16 22:22 UTC
- Aktualny commit aplikacji i migracji `5c3cb856436a110befa0fcf91851948f3df0448c`: CI run 933 SUCCESS i Cloudflare deploy run 519 SUCCESS.
- Ostatni commit dokumentacyjny `6a93c69763ed06b5ee4138d6992437d5208b819b`: CI run 934 SUCCESS; Cloudflare production deploy run 520 SUCCESS. Oznacza to, że najnowszy branch main został wdrożony na produkcyjny Worker.
- Publiczny produkcyjny URL `https://moneyball-global.damianwalus3.workers.dev/` po deployu zwraca stronę MONEYBALL GLOBAL 2.0, opis prognoz 1X2/DC/Goli i stałą stawkę 4 €. Ekstrakcja strony w ostatnim sprawdzeniu: 505 ms; to nie jest pomiar RUM ani czas interakcji zalogowanego panelu.
- Wciąż otwarty oddzielny test: rzeczywiste RUM na zalogowanej sesji MAIN oraz pełne porównanie aktualnego ekranu Mecze z surową listą FootyNomad. Nie ogłaszać pełnego zielonego światła całego projektu na podstawie samego deployu.
## Dodatkowy alias drugiej ligi — Macedonia Północna — 2026-11-16
- Dalsze porównanie europejskich nazw lig wykazało brak aliasu `2 MFL` dla drugiego poziomu w Macedonii Północnej. Dodano alias w filtrze frontendu, FootyNomad sync, free feed i predykcjach oraz test regresyjny.
- Zastosowano produkcyjną migrację `20261116222413_add_north_macedonia_2_mfl_alias`; test SQL rozszerzony do 24/24 PASS.
- Edge Functions wdrożone po tej poprawce: footynomad-sync v74, moneyball-free-feed v31, moneyball-predict v228 — ACTIVE.
- Źródła do porównania nazw poziomów: Stat-Football, OpenFootball leagues, FBref domestic second-tier list oraz UEFA competition landscape. Lista aliasów jest mapowaniem nazw używanych przez źródła, a nie dowodem, że każdy kraj ma w FootyNomad mecze każdego dnia.
## Deduplication of same fixture under different FootyNomad IDs — 2026-11-16
- Audyt aktualnej bazy wykrył duplikat tego samego meczu Kosovo Liga E Pare: `Trepça Mitrovicë – 2 Korriku`, ten sam kickoff, ale external_id `1572681-trep-a-mitrovic-vs-2-korriku` i `1572681`. Oba rekordy mają historię prognoz (12 i 13), więc nie wolno ich kasować ani scalać bez audytu referencji.
- Produkcyjny RPC prediction scan już deduplikuje fixture po dniu Brussels + znormalizowanych nazwach home/away + gender, wybierając rekord FootyNomad z najnowszym updated_at. Dodano analogiczne deduplikowanie na ekranie Mecze, aby nie pokazywać tego samego meczu dwa razy; wybór preferuje FootyNomad, następnie najnowszy rekord. Dane źródłowe i predykcje pozostają zachowane.
- Dodano test regresyjny, który potwierdza, że dwa ID jednego meczu są wyświetlane jako jeden rekord i wybierany jest rekord kanoniczny/nowszy. Wymagane: CI + Cloudflare deploy po tym commicie.
## Filtr importu i czyszczenia cache kobiet/rezerw — 2026-11-16
- Kontrola cyklicznego free-feed po deployu v31 wykazała, że raportował 9 kwalifikujących się fixtures, ale cache nadal zawierał stare rekordy kobiet i rezerw (m.in. Frauen Bundesliga, Olympiakos Piraeus II, Celta de Vigo II, Polissya II). Przyczyna: czyszczenie cache sprawdzało kraj/ligę, ale nie sprawdzało pola gender ani rezerwowych nazw drużyn.
- Poprawiono FootyNomad sync: import przepuszcza wyłącznie gender=men. Poprawiono moneyball-free-feed: import przepuszcza wyłącznie men, a purge cache usuwa rekordy z gender != men oraz drużyny rezerw/B.
- Edge Functions wdrożone: footynomad-sync v75, moneyball-free-feed v32 — ACTIVE. Następny test obowiązkowy: cron free-feed po wdrożeniu (harmonogram co 15 min) i potwierdzenie, że cache dla dzisiejszej daty nie zawiera kobiet/rezerw/pucharów/lig niższych. Nie kasowano rekordów z głównej tabeli matches, bo mogą mieć powiązane predykcje.
## Potwierdzenie feedu po filtrze senior men — 2026-11-16 22:33 UTC
- Po wdrożeniu footynomad-sync v75 i moneyball-free-feed v32 wykonano post-deploy verification na produkcyjnym endpointzie free-feed: HTTP 200, data 2026-11-16, reported_total=8, fixtures_count=8, inserted=0, updated=8.
- Cache `moneyball_global_fixture_feed` po odświeżeniu zawiera dokładnie 8 spotkań: Ukraina Persha Liga 2, Grecja Super League 2 2, Kosovo Liga E Pare 1, Serbia Prva Liga 2, Słowacja 2. liga 1. Wszystkie mają gender=men. Usunięto 4 stare/niepasujące rekordy cache.
- Po odświeżeniu cache nie ma już kobiet, Olympiakos Piraeus II, Celta de Vigo II ani Polissya II. Nie kasowano powiązanych rekordów z głównej tabeli matches i nie naruszono historii prognoz.
- Wynik scan run `88ed9889-5c30-45ab-87b6-59180dec20ce`: completed, 8 fixtures, 0 nowych, 8 aktualizacji, 4 stare/niepasujące rekordy usunięte z cache.
- CI run 951 SUCCESS i Cloudflare production deploy run 537 SUCCESS dla commit `b1e21197e589a2a0fe4cdc102d43d199ce3271b`. Edge Functions active: footynomad-sync v75, moneyball-free-feed v32, moneyball-predict v228.
## Finalny przegląd źródeł i filtrów senior-men — 2026-11-16 22:50 UTC
- Dodatkowy audyt wykazał, że `footynomad-sync` filtrował kobiece mecze z głównego parsera, a `moneyball-free-feed` odrzucał gender != men i usuwał niekwalifikujące się stare rekordy z cache. Pozostała luka: dodatkowe rekordy z `moneyball-public-sources` były łączone bez pełnego sprawdzenia płci i nazw zespołów rezerwowych. Naprawiono `footynomad-sync`: publicFixtures są teraz ograniczone do gender men (lub braku gender) oraz odrzucają rezerwy/B-teamy; drugi filtr bezpieczeństwa działa także tuż przed zapisem po połączeniu źródeł.
- Najnowszy commit tej poprawki: `16452019c5d1e6f4ef28f66da40cb767c55ba268`. CI run 953 SUCCESS i Cloudflare deploy run 539 SUCCESS.
- Aktywne wersje Supabase Edge Functions potwierdzone po wdrożeniu: `footynomad-sync v75`, `moneyball-free-feed v32`, `moneyball-predict v228`; wszystkie ACTIVE.
- Cron potwierdzony aktywny: `moneyball-global-free-footynomad` co 15 minut (`1,16,31,46 * * * *`), `moneyball-results-sync` co 5 minut. Ostatnie uruchomienia cron 22:46 UTC i 22:45 UTC zakończone `succeeded`; logi Edge dla moneyball-free-feed v32 pokazują POST 200, execution ~912 ms, a poprzednia wersja v31 POST 200 ~2696 ms. FootyNomad sync v74 uruchomiony z zalogowanej sesji MAIN i zwrócił 200 w ~5321 ms.
- Dzienny feed `moneyball_global_fixture_feed` dla 2026-11-16 zawiera 8 meczów: Grecja Super League 2 (2), Kosovo Liga E Pare (1), Serbia Prva Liga (2), Słowacja 2. liga (1), Ukraina Persha Liga (2). Wszystkie zapisane rekordy feedu mają `gender=men`; brak kobiet i unknown.
- Audyt tabeli matches wykrył 12 rekordów w tych kwalifikujących się rozgrywkach, ale po odrzuceniu rezerw/B-teamów i deduplikacji pozostaje 8 unikalnych spotkań; jeden duplicate Trepça Mitrovicë–2 Korriku (2 rekordy, jeden kanoniczny) jest zachowany w bazie, a widok Mecze deduplikuje go. Dodatkowe rekordy Celta Fortuna/Celta de Vigo II i Olympiakos Piraeus II pozostają w historii, ale filtr UI/ingest je wyklucza. Nie kasować danych historycznych.
- Produkcyjny root Worker zweryfikowany po deployu 539: tytuł MONEYBALL GLOBAL 2.0, opis poprawny, HTTP ekstrakcja ~724 ms (nie jest to RUM ani czas zalogowanego menu).
- Pozostałe niezamknięte testy całego produktu: pomiar RUM na zalogowanej sesji MAIN (TinyFish profil nadal wymaga zalogowania użytkownika) i rzeczywisty settlement kuponów po potwierdzonym FT. Nie ogłaszać pełnego zielonego światła całej aplikacji tylko na podstawie tych testów.
## Rzeczywisty test E2E rozliczenia kuponów i bankrolla — 2026-11-16 23:xx CET
- Po pojawieniu się potwierdzonych wyników FT oba kupony z 16.11 zostały automatycznie rozliczone przez results-sync. MONEYBALL #1: stake 4.00 EUR, kurs 1.090, zwrot 4.36 EUR, 3/3 legs WON, dokładnie jedna transakcja payout. MONEYBALL #2: stake 4.00 EUR, kurs 1.517, zwrot 6.07 EUR, 3/3 legs WON, dokładnie jedna transakcja payout.
- Sprawdzenie bazy: status obu coupons = won; wszystkie 6 coupon_legs = won; każda z dwóch pozycji ma dokładnie 1 transakcję payout; nie wykryto podwójnego rozliczenia.
- Bankroll ledger po wszystkich transakcjach: depozyty 91.60 EUR, łączna stawka 23.00 EUR, łączny zwrot 15.68 EUR, obliczone saldo 84.28 EUR, wynik netto -7.32 EUR. Saldo obliczone z ledgeru zgadza się z ostatnim balance_after 84.28 EUR.
- Wcześniejsza wartość 73.85 EUR była prawidłowa przed dwoma zwrotami z kuponów #1 i #2; po rozliczeniu wzrosła do 84.28 EUR. To ważna korekta kontekstu — nie wracać do 73.85 jako aktualnego salda.
- To zamyka rzeczywisty test E2E FT -> coupon legs -> coupon status -> payout exactly once -> bankroll ledger. Nadal otwarty jest niezależny test RUM menu po zalogowaniu do zapisanej sesji browser profile.

## Rozszerzenie katalogu lig europejskich poziomu 1 i 2 — 2026-11-16
- Zadanie: rozszerzyć rozpoznawanie nazw wszystkich krajowych lig seniorów poziomu 1 i 2 w europejskim/UEFA zakresie, niezależnie od wariantu nazwy dostawcy (lokalna nazwa, angielska nazwa, nazwa sponsora, transliteracja i alias).
- Research nazw i struktury: UEFA European Club Talent and Competition Landscape 2025/26; FBref 2026/27 Domestic Leagues Tier 2; stat-football country/division index; lista senior professional leagues. Źródła: https://editorial.uefa.com/resources/029d-1ebb1aaaa7ca-fb6fe27d6835-1000/uefa_european_club_talent_and_competition_landscape_15_09_25_lowres.pdf ; https://fbref.com/en/comps/season/2026-2027 ; https://www.stat-football.com/en/clubs/ ; https://downloads.ctfassets.net/uy8bptahieya/7pyen8ebC1T9JWHtE3nHbu/afdccb4f9809c8b58538d470dac1a334/Youth_Migration_Report_25.11.25.pdf
- Rozszerzono aliasy w frontendowym `src/lib/domain.ts` oraz trzech warstwach ingest/predykcji: `supabase/functions/footynomad-sync/index.ts`, `supabase/functions/moneyball-free-feed/index.ts`, `supabase/functions/moneyball-predict/index.ts`. Dodano m.in. warianty nazw lig Azerbejdżanu, Białorusi, Izraela, Kazachstanu, Bośni i Hercegowiny, Bułgarii, Cypru, Irlandii, Irlandii Północnej, Łotwy, Litwy, Luksemburga, Malty, Mołdawii, Czarnogóry, Norwegii, Walii i Gibraltaru.
- Rozszerzono europejski zakres federacji UEFA o Izrael (kraj Israel i kod ISR) we frontendzie, FootyNomad sync, free feed, prediction engine i SQL canonical scope. To zachowuje spójność filtrów dla lig izraelskich, w tym Liga Leumit.
- Produkcyjna funkcja SQL `public.moneyball_is_european_top_two_league(text,text)` została rozszerzona przez migracje:
  - `20261116235000_expand_european_tier_one_two_league_aliases`
  - `20261116235500_include_israel_in_uefa_domestic_league_scope`
- Test SQL po wdrożeniu: **26/26 PASS**. Pozytywne przypadki obejmują m.in. Birinci Liqa, Vysshaya Liga, Pervaya Liga, Liga Leumit, First Division (Kazakhstan), Prva Liga Republike Srpske, Second Professional Football League, Cyprus Second Division, League of Ireland First Division, NIFL Championship, 1. Liga, I Lyga, Division of Honour, Malta Challenge League, Liga 1 (Moldova), Second League (Montenegro), OBOS-ligaen, Cymru North/South i Gibraltar Football League. Negatywne przypadki: Druha Liga, Premier League 2, Regionalliga, Serie C, krajowy puchar i Frauen Bundesliga.
- Dodano testy regresyjne do `src/lib/domain.test.ts` dla powyższych nazw i wykluczeń.
- Commity: backend aliases `12ba02c7d2d85e08f189d2418fcf130151cc8401`, `85354c043c17e53e95c802cc92dad160754c5c2e`, `1766704a3d76a2134e4e5baa3051ab092842d81c`; frontend aliases `c65e8e8610bb4e57e92a8c25d68e2073d1b0dae4`; Israel scope `bd8118d4617dac355cb76eb8e23ac79da7a2348b`, `12144b624d075634a4caeaf2cc1c4b9b01fd4e9f`, `b67fe2ddcb88cf4e0ab8f3e21ece26a6250cf3cf`, `19ba563fe95c33d7c3b0072c9c6bd77f7f142c0a`; tests `94c02ae18202bc40833bbad22ed35c57f06948e8`, `67cee3f6fa394716055dedefcb343dcae5d024ff`; SQL migration files `3172c62fcbd53bad76027665b8cbd30ac64057af`, `bb68590990bce7b0420ad0a5b6b914e0fdee98a0`.
- CI Moneyball #967 / run `43975520108` i Cloudflare deploy #553 / run `43975520075` wystartowały dla commita `67cee3f6fa394716055dedefcb343dcae5d024ff`; w chwili zapisu oba były `in_progress`. Nie uznawać wdrożenia frontendu za zakończone przed SUCCESS i sprawdzeniem produkcyjnego Worker.
- Ograniczenia zakresu bez zmian: tylko dzisiejsze mecze Europe/Brussels, krajowe ligi seniorów poziomu 1/2; bez pucharów, reprezentacji, kobiet, młodzieży, rezerw/B-teamów i poziomów 3+. Brak ligi krajowej poziomu 2 w danym kraju nie oznacza dopuszczania poziomu 3.

- Korekta regresji ujawnionej przez CI #967: test wykrył, że nazwa `Serie C - Girone B` wpadała do dopuszczonego wzorca przez zbyt ogólną frazę. Dodano jawne wykluczenie `Serie C` / `Lega Pro` we frontendzie, FootyNomad sync, free feed, prediction engine oraz SQL. Migracja produkcyjna: `20261116235900_exclude_italian_serie_c_from_top_two_scope`; plik zapisany w repo commit `90fda8fba5710b96c32f03c20a1906dba7ee3674`. CI #973 i Cloudflare deploy #559 dla tego commita wystartowały; status końcowy oczekuje na weryfikację.

- Kolejna regresja z CI #974: nazwa `League One` (angielski poziom 3) pasowała do szerokiego wzorca `football league`. Dodano jawne wykluczenia `League One/Two/Three` we frontendzie, FootyNomad sync, free feed, prediction engine i SQL. Migracja: `20261117000500_exclude_english_lower_divisions_from_top_two_scope`; plik repo commit `2286b55edad22496c3fa1b972ae678a753c2eff4`.
- Ponowny test SQL po obu korektach: **29/29 PASS**, w tym pozytywne nazwy nowych lig i negatywne: Serie C, Lega Pro, League One, League Two, puchary, kobiety, U21/PL2, Druha Liga i Regionalliga.
- Ostatni kod frontend/backend dla wykluczenia League One/Two/Three: `5a1c0774fc9460a8e7ce211c8759cd46e0281bf6`, `d576a39785f0bcb417ea4511a069eb2726f478c2`, `b3b32b1bfd70f3e8ba0e3f9c42ac210bf3222404`, `2990863bcbf20d65ee22aaa260efbd0091b0c6ca`. CI #974 ujawnił regresję; poprawka została dodana i wymaga nowego pełnego CI/deploy.


## Kontynuacja audytu lig — 2026-11-17 (FootyNomad exact-label verification)
- Kontynuacja zadania #76: https://github.com/damianwalus3-jpg/moneyball-global/issues/76. Nie tworzyć ponownie tego zadania ani nie powtarzać już wykonanych poprawek; dopisywać wyniki do tego wpisu.
- Źródło rzeczywistych etykiet dostawcy: publiczny katalog FootyNomad https://footynomad.com/browse (odczyt 2026-11-17). Katalog pokazuje m.in. Andorra: `1a Divisió`, `2a Divisió`; Azerbaijan: `Birinci Dasta`, `Premyer Liqa`; Belarus: `1. Division`, `2. Division`, `Premier League`; Bosnia: `1st League - FBiH`, `1st League - RS`, `Premijer Liga`; Luxembourg: `National Division`; Iceland: `1. Deild`, `Úrvalsdeild`; Faroe Islands: `1. Deild`, `Meistaradeildin`. Katalog zawiera też niższe ligi i puchary, dlatego nie wolno przyjmować wszystkich nazw bez kontroli poziomu.
- Produkcyjny test SQL PRZED poprawką potwierdził konkretne luki: Andorra `1a Divisió` = false, `2a Divisió` = false; Azerbaijan `Birinci Dasta` = false. Belarus `1. Division` i `2. Division` już przechodziły. Puchary Andory i trzeci poziom Azerbejdżanu pozostawały odrzucone.
- Poprawiono aliasy `1a divisio`, `2a divisio`, `birinci dasta` w czterech warstwach kodu:
  - `src/lib/domain.ts` commit `d0fd1730758c5fcaac35f358724b1fe9dec7589e`
  - `supabase/functions/footynomad-sync/index.ts` commit `b5016e2d477df95fca3d2534561a67c715599d90`
  - `supabase/functions/moneyball-free-feed/index.ts` commit `590913908798a7eb768b90b38f81b84fd37c96e2`
  - `supabase/functions/moneyball-predict/index.ts` commit `8447c12bbeabed1edb1cb8b786042f88ad712378`
- Dodano testy regresyjne w `src/lib/domain.test.ts` dla dokładnych etykiet FootyNomad Andory, Azerbejdżanu i Białorusi; commit `dc9ada815bd5e0f7b1d0224c2dffbe7f8da2ed0d`.
- Dodano migrację `supabase/migrations/20261117010000_add_footynomad_andorra_azerbaijan_aliases.sql`, commit `d6a5db91265d0a85aeb69f832c0e834895e94024`. Migracja została zastosowana bezpośrednio w istniejącym Supabase project `gzgeklcukrclgwbsmbsp` przez `apply_migration`; wynik success=true.
- Test produkcyjnej funkcji SQL po migracji: 11/11 oczekiwań zgodnych (pusty zbiór rozbieżności). Pozytywne: Andorra 1a/2a Divisió, Azerbaijan Birinci Dasta, Belarus 1./2. Division. Negatywne: Andorra Copa Constitució, Azerbaijan Third Division, England League One, Italy Serie C, Germany Frauen Bundesliga, England Premier League 2.
- Status CI/deploy: status check dostępny przez GitHub dla commita migracji zwrócił tylko Vercel failure z powodu build-rate-limit; nie jest to dowód wyniku Cloudflare. Na tym etapie NIE potwierdzono CI ani produkcyjnego Cloudflare deployu najnowszych zmian frontendowych/Edge Functions. Nie deklarować ich jako wdrożonych.
- Następne kroki: uruchomić pełne testy frontendowe i typecheck/build dla najnowszego main; sprawdzić wynik workflow Cloudflare, wdrożyć trzy Edge Functions do istniejącego projektu i frontend do istniejącego Cloudflare Worker dopiero po zielonych testach; następnie porównać surowy feed FootyNomad z cache i prognozami na dzisiejszą datę Europe/Brussels. Kontynuować audyt wszystkich krajów europejskich z katalogu, dodając tylko potwierdzone senior-men tier 1/2 aliasy i zachowując wykluczenia tier 3+, pucharów, kobiet, młodzieży i rezerw.


## Dodatkowy audyt false-positive tier 3 i naprawa feedu — 2026-11-17
- Podczas kontroli dziennego cache FootyNomad znaleziono 7 rekordów Scotland `Football League - Lowland League`, które przechodziły szeroki alias `football league`. To liga piątego poziomu, nie Championship. Źródło: Scottish FA potwierdza strukturę tier 5 dla Lowland i Highland League (https://www.scottishfa.co.uk/en/news/tier-5-restructure-approved-by-scottish-fa-for-20262027-season); katalog FootyNomad na https://footynomad.com/browse pokazuje dostawcze etykiety `Football League - Lowland League` i `Football League - Highland League`.
- Audyt oficjalnych/aktualnych struktur ujawnił też niebezpieczne generyczne aliasy, które mogły dopuścić poziom 3+: Turkey `2. Lig`, Denmark `2. Division`, Norway `2. Division`, Sweden `Division 1/2`, Belarus `2. Division`, Albania `2nd Division`, Croatia `Second NL`, Estonia `Esiliiga B`, Greece `Football League`. Zachowane zostały prawidłowe drugie poziomy: Turkey 1. Lig, Denmark/Norway 1. Division, Sweden Superettan, Belarus 1. Division, Albania 1st Division, Croatia First NL, Estonia Esiliiga A, Greece Super League 2 i Scotland Championship.
- Dodano country-aware wykluczenia w:
  - `src/lib/domain.ts` commit `b7b06e9b4c3f57f2131dab11e784756feda1c814`
  - `supabase/functions/footynomad-sync/index.ts` commit `3ebc1dd930169b1ec7513b894344644df79794d8`
  - `supabase/functions/moneyball-free-feed/index.ts` commits `6fc70440487222f8fa82134836de308aba008df8`, `69d28625274c50430bd58b98a82d34a8618c8bc8` (ostatni dopina country-aware cache purge)
  - `supabase/functions/moneyball-predict/index.ts` commit `deb334ee13133b192702182d2cfa3e7efdc29b0c`
  - testy regresyjne `src/lib/domain.test.ts` commit `c47637c7b83a71eae80a89d5a8a8183fceca884a`; następnie skorygowano historyczny błędny oczekiwany wynik Belarus 2. Division (poziom niższy) w commicie `8b6ca7d07215e3efac61079c5f3cadfb6fa13017`.
- Produkcyjna funkcja SQL została rozszerzona migracją `20261117013000_exclude_country_specific_european_tier_three_aliases` oraz poprawkami escapingu regex w migracjach `20261117014000_fix_country_tier_exclusion_regex`, `20261117015000_fix_country_tier_exclusion_regex_single_slash`, `20261117016000_fix_mixed_regex_escape_sequences`. Końcowy test SQL **24/24 oczekiwań zgodnych, 0 rozbieżności**.
- Aktywne wersje Supabase Edge Functions po deployu: `footynomad-sync v77`, `moneyball-free-feed v34`, `moneyball-predict v230`; wszystkie ACTIVE.
- Po deployu v34 cache dzienny nadal zawierał 7 starych wpisów Lowland League. Usunięto dokładnie te 7 niekwalifikujących się wierszy z disposable `moneyball_global_fixture_feed` przy użyciu aktualnej funkcji SQL. Ponowna kontrola cache: tylko Northern Ireland Championship (2 fixtures), brak Lowland/Highland. Główna tabela `matches` zachowuje 8 historycznych/źródłowych rekordów Lowland; NIE usuwano ich ani ich predykcji. Aktualny filtr SQL/frontend/prediction wyklucza je z panelu i skanu.
- Cron `moneyball-global-free-footynomad` pozostaje aktywny co 15 minut. Następny cykliczny przebieg powinien odtworzyć cache na podstawie poprawionej funkcji v34; po nim ponownie sprawdzić cache.
- Status frontendu Cloudflare: niepotwierdzony. Workflow `.github/workflows/deploy-cloudflare.yml` uruchamia walidację Deno, testy Vitest, TypeScript, build Cloudflare i deploy przy push do main. Dostępny GitHub combined status pokazuje jedynie niezwiązany Vercel build-rate-limit failure; nie jest to wynik Cloudflare. Nie oznaczać frontendu jako wdrożonego, dopóki run workflow i Worker nie zostaną zweryfikowane.
- Nie zamykać issue #76. Pozostaje: potwierdzić zielony CI/Cloudflare deploy najnowszego main, test produkcyjnego Workera i porównać kompletną dzienną listę FootyNomad z cache/matches/predictions dla wszystkich krajów. Nie powtarzać już zastosowanych migracji ani deployów Edge v77/v34/v230 bez nowej regresji.


## Finalizacja aliasów kodów krajów i aktualny stan wdrożeń — 2026-11-17
- Rozszerzono country-aware wykluczenia o kody federacji/krajów i wariant `Türkiye`, aby identyczny filtr działał przy pełnej nazwie, transliteracji i kodzie:
  - frontend `src/lib/domain.ts`: commit `7111c6ada7a3213f1c9a1784a2fbddb1527d9981`, następnie dodanie `turkiye` do zbioru państw `17aaf82719e325f3c12d2978d61361c3519fbffc`
  - FootyNomad sync: `2b57158a4721502b9e34259e539cf4ac633e791e`
  - free feed/cache purge: `71b6f50b166433cd9d6039f85a2fc8a156e0b3ea`
  - prediction engine: `c3a82b7f0598ccbbfb0ea0676f9c83a27b9c0615`
  - testy kodów kraju i pozytywnego `Türkiye 1. Lig`: `842c6cf45f3e317e7b072326d5cd7e6fd18b6568`, `8eadb9eaa4ba8896e27182c8d97eb9696c2a1a64`.
- Ponownie wdrożone Edge Functions po zmianie kodów kraju: `footynomad-sync v78`, `moneyball-free-feed v35`, `moneyball-predict v231`; wszystkie ACTIVE.
- Produkcyjny SQL zweryfikował dodatkowe warianty: Türkiye 1. Lig = true; Türkiye/TUR 2. Lig = false; SCO Lowland League = false; DNK 2. Division = false; SWE Division 1 = false.
- Dzienny cache po czyszczeniu nadal zawiera tylko Northern Ireland Championship (2 fixtures); siedem Lowland League usuniętych wpisów nie wróciło w ostatnim odczycie. Główne rekordy matches pozostają zachowane.
- Frontend test suite i Cloudflare Worker deployment nadal wymagają potwierdzenia z GitHub Actions. Ostatni znany status check to Vercel build-rate-limit i nie może być interpretowany jako wynik Cloudflare. Nie zamykać issue #76 ani nie deklarować pełnego wdrożenia UI.


## Rozszerzony audyt fałszywych trafień Rosja/Hiszpania/Szwajcaria/Dania — 2026-11-17
- Katalog FootyNomad https://footynomad.com/browse zawierał kolejne nazwy, które kolidowały z generycznymi wzorcami poziomu 2:
  - Rosja: `First League` = tier 2, ale `Second League A` i `Second League` = tier 3/4. Źródło poziomu: https://en.wikipedia.org/wiki/Russian_Second_League oraz dokumentacja RFU https://www.rfs.ru/subject/1/documents/preview?documentId=2057.
  - Hiszpania: `Primera Federación` jest tier 3, `Segunda Federación` tier 4; profesjonalne Primera/Segunda División pozostają tier 1/2. Źródło RFEF: https://rfef.es/es/federacion/bases-de-competicion-202526 oraz https://rfef.es/es/competiciones/segunda-federacion.
  - Szwajcaria: `Hoval Promotion League` = tier 3, `1. Liga Classic` = tier 4; Super League i Challenge League są tier 1/2. Źródła SFV: https://org.football.ch/desktopdefault.aspx/tabid-2869/8789_read-165693/ oraz https://matchcenter.football.ch/default.aspx?lng=1&oid=1.
  - Dania: `2. Division` i `2nd Division` to tier 3, a `1. Division` to tier 2. Źródło FIFA/DBU comparative analysis: https://profootball.fifa.com/pluginfile.php/1761/mod_resource/content/1/Comparative%20Analysis%20of%20second%20and%20third%20division%20%28FINAL%20-%2031.08.2021%29_compressed.pdf.
- Dodano country-specific wykluczenia w frontendzie `src/lib/domain.ts` commit `c77188d3fd85937dcdff3d4d92a8508301e81b5f`, w trzech Edge Functions:
  - FootyNomad sync: `8014125caf76d7b8373d71cd67c799216a5630d9`
  - free feed: `9cd51039dd2a9ba487050313ed134e6545922f53`
  - prediction engine: `96310a9a506016922973920acc073586838417d5`
  - testy frontendowe: `968e219337d842bba06288ba876593861e802821`
- Produkcyjna migracja SQL `20261117020000_exclude_additional_european_tier_three_aliases` (commit `e39e3d72a4805f5f692e060a7cba80dcbe419e1f`) dodała wykluczenia dla Danii 2nd Division, Rosji Second League, Hiszpanii Primera/Segunda División RFEF oraz Szwajcarii 1. Liga Promotion/Classic.
- Końcowa macierz produkcyjnego SQL: **40/40 przypadków zgodnych, 0 rozbieżności**. Obejmuje pozytywne tier 1/2, negatywne tier 3/4, nazwy z FootyNomad i kody krajów.
- Edge Functions ponownie wdrożone i ACTIVE: `footynomad-sync v79`, `moneyball-free-feed v36`, `moneyball-predict v232`.
- Oczyszczono dzienny feed cache zgodnie z nową funkcją; usunięto zero kolejnych niekwalifikujących się rekordów (poprzednie 7 Lowland League zostało już usunięte). Cache nie zawiera obecnie kolejnych wykrytych tier-3 false positives.
- Pozostaje wymagane: pełny frontend Vitest/TypeScript/build oraz potwierdzenie Cloudflare Worker deployment. Nie zamykać issue #76 bez statusu Cloudflare i kontroli UI.


## Finalna runda false-positive audit — Rosja/Hiszpania/Szwajcaria/Dania — 2026-11-17
- Rozszerzono filtr o dokładne etykiety z FootyNomad i zweryfikowaną strukturę krajową:
  - Denmark `2nd Division - Group 2` (tier 3)
  - Russia `Second League A - Division A Gold/Silver` i `Second League - Group 1..4` (tier 3/4), przy zachowaniu `First League` (tier 2)
  - Spain `Primera División RFEF` (tier 3) i `Segunda División RFEF` (tier 4), przy zachowaniu `Primera/Segunda División` (tier 1/2)
  - Switzerland `1. Liga Promotion` (tier 3) i `1. Liga Classic` (tier 4), przy zachowaniu `Super League` i `Challenge League` (tier 1/2).
- Frontend country-aware exclusions: commit `c77188d3fd85937dcdff3d4d92a8508301e81b5f`.
- Backend Edge Functions:
  - footynomad-sync: `8014125caf76d7b8373d71cd67c799216a5630d9`
  - moneyball-free-feed: `9cd51039dd2a9ba487050313ed134e6545922f53`
  - moneyball-predict: `96310a9a506016922973920acc073586838417d5`
- Testy regresyjne: `968e219337d842bba06288ba876593861e802821`.
- Produkcyjna migracja SQL `20261117020000_exclude_additional_european_tier_three_aliases`, commit `e39e3d72a4805f5f692e060a7cba80dcbe419e1f`.
- Pełna rozszerzona macierz SQL: **40 testów, 0 rozbieżności**. Dzienny feed cache: Northern Ireland Championship 2 fixtures; zero kolejnych niekwalifikujących się rekordów.
- Edge Functions po wdrożeniu: `footynomad-sync v79`, `moneyball-free-feed v36`, `moneyball-predict v232` — wszystkie ACTIVE.
- Aktualny GitHub combined status nadal pokazuje tylko Vercel build-rate-limit failure; nie daje statusu workflow Cloudflare. Nie ogłaszać produkcyjnego deployu frontendu. Następny etap nadal wymaga potwierdzenia CI/test/build/Cloudflare i kontroli Worker.


## Końcowe aliasy kraju z katalogu FootyNomad — 2026-11-17
- Odczyt katalogu FootyNomad https://footynomad.com/browse wykazał, że dostawca używa nazw krajów `Bosnia` i `Macedonia`, a nie zawsze pełnych nazw oficjalnych. Poprzednie zestawy krajów akceptowały tylko `Bosnia and Herzegovina` i `North Macedonia`; takie rekordy mogły zostać odrzucone przed sprawdzeniem ligi.
- Dodano aliasy krajów `bosnia`, `macedonia`, `turkiye` do frontendu i trzech Edge Functions:
  - frontend: `69c4c38e272955db6bf7c26739cb0fa3a4a865c7`
  - footynomad-sync: `f7f04702bca047c12802dce93ed6f4b84d4720ee`
  - moneyball-free-feed: `67269b24887b01e50befb090ed824498f4eaac76`
  - moneyball-predict: `ff49cec4e7ab133c21a18a16a1a748041697fe81`
- Dodatkowy brak: allowlista obejmowała `Erovnuli Liga 2`, ale nie topową `Erovnuli Liga`. Dodano obie nazwy jako dozwolone poziomy 1/2. Testy: `cd33bd1d0f12a66e2c4f47f14c2660fe9fa46dc9`.
- Produkcyjna migracja SQL `20261117023000_add_footynomad_country_aliases_and_georgia_top_tier`, commit `52ab56e1956db43ef1444f1a8151bce46b602895`, dodała aliasy country w canonical SQL scope i `erovnuli liga` do allowlisty.
- Rozszerzona macierz produkcyjnego SQL: **47 przypadków, 0 rozbieżności**, w tym Bosnia, Macedonia, Georgia, Türkiye i wszystkie poprzednie tier 1/2 oraz false-positive tier 3/4.
- Edge Functions ponownie wdrożone i ACTIVE: `footynomad-sync v80`, `moneyball-free-feed v37`, `moneyball-predict v233`.
- Aktualny dzienny feed cache nadal zawiera tylko Northern Ireland Championship (2 fixtures); brak znanych false-positive tier 3/4.
- Nadal niepotwierdzone: GitHub Actions Vitest/TypeScript/build oraz produkcyjny Cloudflare Worker frontend. Nie zamykać issue #76 bez potwierdzenia tych kroków.


## Krytyczna naprawa filtra lig — pusta alternatywa regex — 2026-11-17
- Po ręcznym wywołaniu produkcyjnego `moneyball-free-feed` wersja 37 wykryto, że do cache trafiały France `National 2` i `UEFA Nations League`. Kontrola kodu ujawniła wadliwą alternatywę `liga ii||vysshaya liga` w regex allowlisty trzech Edge Functions. Pusta alternatywa `||` dopasowywała pusty ciąg, więc mogła przepuszczać dowolną nazwę rozgrywek. To był bezpośredni root cause błędnych importów i części prognoz.
- Naprawiono regex do `liga ii|vysshaya liga` w:
  - frontend `src/lib/domain.ts`: commit `36b0e98fda1f2cbbb108e9a04a5546f31c28f700`
  - FootyNomad sync: commit `f4a4be26346be2b2d0bcd2b38e41a58e1cd847cc`
  - free feed: commit `c6361a527177432fc38e03307433a80028ccb09a`
  - prediction engine: commit `282144050b838841a346d45a7efaed6c3bffebe0`
- Dodano jawne wykluczenie rozgrywek międzynarodowych (UEFA, Nations/Champions/Europa/Conference League, World Cup, international) oraz francuskich National 2–5. Testy regresyjne: commit `0d144d16f670cb647d263c8c876d11d007057bb4`.
- Edge Functions po naprawie wdrożone i ACTIVE: `footynomad-sync v81`, `moneyball-free-feed v38`, `moneyball-predict v234`.
- Produkcyjny test funkcji free-feed po wdrożeniu v38: HTTP 200; `date=2026-11-17`; `reported_total=2`, `fixtures_count=2`, `inserted=0`, `updated=2`. Ponowny odczyt cache: tylko Northern Ireland Championship (2 fixtures); `bad_cache_rows=0`. France National 2 i 8 UEFA Nations League usunięto przez poprawiony filtr purge.
- Rozszerzona macierz SQL canonical scope: **51 przypadków, 0 rozbieżności**, w tym World UEFA Nations League = false, France National 2/3 = false, France Ligue 2 = true.
- Audyt predykcji dla dzisiejszych meczów spoza scope: France National 2 (16 wierszy), Scotland Lowland League (84), UEFA Nations League (96); łącznie **196 historycznych prognoz**. Wszystkie mają verdict `ODRZUCONY`, status pending i **0 powiązanych coupon_legs**. Nie kasowano rekordów ani historii; pozostają odrzucone i są wykluczane z bieżącego scope.
- Dwa kwalifikujące się spotkania Northern Ireland Championship mają już prognozy MONEYBALL GLOBAL 3.8 dla 1X2, osobnego Double Chance i GOALS; wszystkie zostały oznaczone ODRZUCONY, 0 WYBRANY. Harmonogram predykcji zwrócił `skipped=cooldown`, `next_scan_at=2026-11-17T07:00:00Z` (08:00 Europe/Brussels); nie omijać blokady cooldown. Następny zaplanowany skan użyje wersji v234.
- Nadal niepotwierdzone: frontend Vitest/TypeScript/build i Cloudflare Worker deployment. Nie zamykać issue #76 bez potwierdzenia CI i produkcyjnego UI.


## Potwierdzenie filtrów dashboardu i aktualny stan prediction scheduler — 2026-11-17
- SQL RPC `moneyball_dashboard_summary()` i `moneyball_dashboard_selected_picks()` nadal zawierają wywołania `moneyball_is_european_top_two_league`; out-of-scope predictions nie powinny trafiać do głównego panelu/wybranych typów.
- Frontend `src/routes/_authenticated/mecze.tsx` filtruje mecze przez `isEligibleEuropeanMatch` i deduplikuje listę; aktualna gałąź main używa poprawionego `domain.ts`.
- **Korekta stanu cron #11:** aktualny odczyt produkcyjny `cron.job` pokazuje `moneyball-global-auto-predict-sequential` jako `active=true`, harmonogram `* * * * *`. Wcześniejsza notatka o `active=false` jest nieaktualna. Job używa `moneyball_claim_prediction_scan` z lease i cooldown; nie wyłączać ani nie omijać blokady bez nowego audytu.
- Ręczne wywołanie scheduled prediction endpointu z aktualną wersją v234 zwróciło HTTP 200 i `skipped=true, reason=cooldown, next_scan_at=2026-11-17T07:00:00Z` (08:00 Europe/Brussels). Nie wymuszać skanu przed tym terminem.
- Obecne dwa kwalifikujące się mecze Northern Ireland Championship mają prognozy 1X2, DOUBLE_CHANCE i GOALS; wszystkie 26 typów są ODRZUCONY, 0 WYBRANY. Nie ma podstaw do tworzenia kuponu.
- Dla dzisiejszych niekwalifikujących się meczów wykryto 196 istniejących wierszy prognoz (France National 2, Scotland Lowland League, UEFA Nations League); wszystkie są ODRZUCONY/pending i nie mają żadnych coupon_legs. Zachować je bez kasowania; aktualne RPC i filtry scope mają je wykluczać z głównego widoku.


## Potwierdzenie pełnego deployu frontendu Cloudflare — 2026-11-17
- Dodano nieinwazyjny meta fingerprint do `src/routes/__root.tsx`: `league-scope-version=europe-top-two-2026-11-17-51case`, commit `67b907108fe49bf7eea09a58b1d83d6a126c5e90`. Znacznik umożliwia weryfikację konkretnego builda produkcyjnego bez dostępu do zalogowanego panelu.
- GitHub Actions Cloudflare workflow run **#620**, ID `43980246198`, dla dokładnego commita `67b907108fe49bf7eea09a58b1d83d6a126c5e90`: **SUCCESS**. Kroki: install dependencies, Deno check wszystkich Edge Functions, Vitest, TypeScript, Cloudflare build i Deploy to Cloudflare Workers — wszystkie SUCCESS.
- Produkcyjny Worker `https://moneyball-global.damianwalus3.workers.dev/?scope_check=europe-top-two-2026-11-17-51case`: HTTP 200; w odpowiedzi HTML znaleziono dokładny fingerprint `europe-top-two-2026-11-17-51case` (pozycja 691). To potwierdza, że nowy frontend faktycznie działa na produkcji.
- Nie użyto ani nie przywrócono Vercel; właściwym workflow jest `.github/workflows/deploy-cloudflare.yml`.
- Status prac: filtry i aliasy są wdrożone na produkcji; Supabase Edge Functions ACTIVE v81/v38/v234; produkcyjny cache ma 2 kwalifikujące się spotkania i 0 false-positive rows; SQL scope 51/51 PASS. Pełny dzienny prediction scan dla kolejnej partii pozostaje zgodny z cooldown do 08:00 Europe/Brussels.
- Issue #76 pozostaje otwarte wyłącznie jako ciągły audit kompletności aliasów/katalogu FootyNomad; nie powtarzać już wdrożonych poprawek, migracji ani testów bez nowej regresji. Punkt startowy dalszej pracy: issue #76 i ten dziennik.


## Naprawa pustej alternatywy regex w frontendzie i alias Czech Liga — 2026-11-17
- Dalszy odczyt pełnego katalogu FootyNomad po poprzednim audycie ujawnił aktualne etykiety lig krajowych. Katalog Czech zawiera link do ligi `czech-liga` (Czech Liga), a oficjalna struktura rozgrywek Czech potwierdza Czech First League jako poziom 1; FNL pozostaje poziomem 2. Źródła: https://footynomad.com/country/czech-republic ; https://en.wikipedia.org/wiki/Czech_First_League.
- Potwierdzono też nazwy bośniackie `1st League - FBiH` i `1st League - RS`. Obie są poziomem 2; istniejący alias `1st league` już je obejmuje, a testy frontendowe i SQL potwierdziły oba warianty. Nie dodawano zbędnych duplikatów.
- **Krytyczna regresja:** w aktualnym `src/lib/domain.ts` allowlista zawierała pustą alternatywę `super league albania||vysshaya liga`. Backendowe regexy nie zawierały tej konkretnej pustej alternatywy, ale frontend mógł przez nią akceptować dowolną nieznaną nazwę ligi w obsługiwanym kraju. Poprawiono wzorzec do `super league albania|czech liga|vysshaya liga`.
- Commity:
  - frontend domain fix + Czech alias: `79667a14f257c4f8ae60e04034da07a9834a95c2`
  - testy regresyjne: `75432a95d592c4ad3903e247ee7423b010e48c2f`
  - FootyNomad sync: `3e5e90728269fa61469d8a275298c0aa8b6e534a`
  - free feed: `60965f9c9ef81079381e9367b835bf63cebe68da`
  - prediction engine: `87918da33052301fcc19b8aa223de19022ab98bc`
  - migracja SQL `20261117030000_add_footynomad_czech_liga_alias.sql`: `4a74c73a4c161f30943272d0f4e21d64afb00fba`
- Testy frontendowe rozszerzono o Czech Liga dla aliasów Czechia/Czech Republic, Bosnia 1st League RS i FBiH oraz negatywne testy Belgium Provincial/Unknown Regional Competition. Ostatnie dwa testy są regresją zabezpieczającą przed ponownym wprowadzeniem pustej alternatywy.
- Migracja SQL zastosowana produkcyjnie. Nowa macierz SQL: **14/14 PASS**, w tym Czech Liga = true, FNL = true, oba bośniackie First League = true, Belgian Provincial/Unknown = false, Czech 3. Liga = false, France National 2 = false, England League One = false, Scotland Lowland = false, Spain RFEF tier 3 = false i Switzerland 1. Liga Classic = false.
- Edge Functions wdrożone i ACTIVE: `footynomad-sync v82`, `moneyball-free-feed v39`, `moneyball-predict v235`.
- GitHub Actions Cloudflare run #627, ID `44010100845`, dla commita migracji `4a74c73a4c161f30943272d0f4e21d64afb00fba` był w trakcie wykonywania podczas zapisu. Poprzedni run #623 został anulowany przez concurrency po nowszych commitach. **Nie uznawać jeszcze frontendu za wdrożony**: wymagane zielone CI/Vitest/TypeScript/build/deploy i ponowny test produkcyjnego Workera po zakończeniu najnowszego runu.
- Produkcyjny Worker nadal zwracał poprzedni fingerprint `europe-top-two-2026-11-17-51case` przy ostatnim odczycie przed zakończeniem runu; to oczekiwane przed nowym deployem. Nie zmieniać ani nie odtwarzać Vercel.
- Issue #76 pozostaje OPEN. Następny krok: sprawdzić wynik najnowszego Cloudflare workflow po commicie dokumentacji, zweryfikować fingerprint nowego buildu i kontynuować audyt wszystkich pozostałych nazw tier 1/2 z FootyNomad. Nie powtarzać już tej poprawki, migracji ani testu 14-case bez nowej regresji.


### Końcowa weryfikacja wdrożenia — 2026-11-17 03:30 UTC
- Korekta statusu z notatki powyżej: Cloudflare workflow #627 zakończył się **SUCCESS** (run ID `44010100845`) i wdrożył wszystkie zmiany aplikacyjne. Wszystkie kroki, w tym Vitest, TypeScript, Deno check i Deploy to Cloudflare Workers, zakończone SUCCESS.
- Workflow #628 (dokumentacyjny commit) został anulowany przez mechanizm concurrency; nie wpływa to na udany deploy #627.
- Fingerprint produkcyjny zaktualizowano w `src/routes/__root.tsx` do `europe-top-two-2026-11-17-regexfix-czechliga`, commit `770262f7078660df80eca40d642f874902bbae83`.
- Cloudflare workflow #629, run ID `44010260708`, dla tego commita zakończył się **SUCCESS**. Wszystkie kroki: Deno, Vitest, TypeScript, Cloudflare build i Deploy — SUCCESS.
- Bezpośrednia kontrola produkcyjnego Workera `https://moneyball-global.damianwalus3.workers.dev/?audit=final-fingerprint-regexfix-czechliga`: HTTP 200; HTML zawiera dokładny fingerprint `europe-top-two-2026-11-17-regexfix-czechliga`; bundle JS `/assets/index-BVeDORqf.js`. To potwierdza wdrożenie właściwej wersji na produkcji Cloudflare.
- Edge Functions ACTIVE: `footynomad-sync v82`, `moneyball-free-feed v39`, `moneyball-predict v235`. Migracja SQL zastosowana; nowa macierz 14/14 PASS.
- Ostateczny stan: poprawka regexu i alias Czech Liga są wdrożone na MAIN/Cloudflare; issue #76 pozostaje otwarte do dalszego audytu pełnej listy europejskich lig. Nie oznacza to zakończenia całego projektu MONEYBALL.


## Dalszy audyt katalogu FootyNomad — 6 brakujących nazw tier 1/2 — 2026-11-17
- Wznowiono audyt od katalogu `https://footynomad.com/browse` i odczytano bezpośrednie linki do krajowych lig. Wykryto 6 brakujących nazw, które canonical SQL scope odrzucał mimo że są rozgrywkami pierwszego lub drugiego poziomu:
  1. Croatia — `HNL` (tier 1); `First NL` (tier 2; istniejący alias już działał).
  2. Finland — `Ykkösliiga` (tier 2; normalizowane do `ykkosliiga`; `Ykkönen/Kakkonen` nie są dodawane jako tier 2).
  3. Kosovo — `Liga e Parë` (tier 2; po normalizacji `liga e pare`).
  4. Lithuania — `1 Lyga` (tier 2).
  5. San Marino — `Campionato` (tier 1; alias dokładny i ograniczony do kraju San Marino).
  6. Slovenia — `1. SNL` (tier 1) i `2. SNL` (tier 2); `3. SNL` pozostaje wykluczone.
- Zweryfikowano też istniejące nazwy providerowe w macierzy 104 przypadków; przed tą poprawką 98/104 przechodziło SQL scope, 6/104 wymagało uzupełnienia. Źródła katalogu: https://footynomad.com/browse (bezpośrednie linki do lig i krajów). Klasyfikację HNL/Prva NL, Ykkösliiga i litewskiej I Lyga potwierdzono w zewnętrznym przeglądzie struktury lig.
- Frontend `src/lib/domain.ts` otrzymał dokładne wyjątki krajowe dla `Croatia/HNL` i `San Marino/Campionato`, oraz aliasy `1 lyga`, `1 snl`; istniejące `ykkosliiga`, `liga e pare`, `first nl` i `2 snl` zostały zachowane.
- Te same zasady zsynchronizowano w `footynomad-sync`, `moneyball-free-feed` i `moneyball-predict`. Nowe testy Vitest obejmują 6 brakujących nazw oraz negatywne przypadki: Croatia Second NL, Finland Kakkonen/Ykkönen i Slovenia 3. SNL East.
- SQL canonical helper znormalizowano dodatkowo o znaki `öäåë` (m.in. Ykkösliiga i Parë) i dodano aliasy `1 lyga`, `1 snl`. `HNL` i `Campionato` są dopuszczane wyłącznie przy odpowiednim kraju, aby nie poszerzać globalnej allowlisty.
- W trakcie migracji wykryto problem w pierwszym dynamicznym wstawieniu country-specific aliasów do SQL (dotknęło też wcześniejszych klauzul wykluczeń). Nie pozostawiono tej wersji: canonical helper został odbudowany z oryginalnymi 12 warunkami wykluczającymi i końcową allowlistą; finalna migracja źródłowa: `20261117034000_rebuild_european_scope_sql_allowlist.sql`, commit `7f7517e8f5425e463871dbe4a7ba0705b8aa62b9`. Po odbudowie testy SQL: **20/20 PASS**, w tym HNL=true, Campionato=true, Ykkösliiga=true, Liga e Parë=true, 1 Lyga=true, 1./2. SNL=true; Croatia Second NL=false, Finland Ykkönen/Kakkonen=false, Slovenia 3. SNL=false, Czech 3. Liga=false, Belgian Provincial=false, France National 2=false, Scotland Lowland=false, Spain RFEF tier 3=false i Swiss 1. Liga Classic=false.
- Edge Functions wdrożone i ACTIVE po synchronizacji: `footynomad-sync v83`, `moneyball-free-feed v40`, `moneyball-predict v236`.
- Commity aplikacyjne: frontend `04cbd45df7811c155604fcacb7d854898f12f71f`; testy `40b1b43f6506e5533a4e66f8d792cee20d96437f`; FootyNomad sync `ad4e16c9e062f2e094715d9a376d571bd6cfe0d5`; free feed `eaf8ab461ff3b817cd17658af815300f9770f85c`; prediction `1e5a5aeac63768026b5374cbbb18cfbb634f99b4`. SQL source migration rebuild: `7f7517e8f5425e463871dbe4a7ba0705b8aa62b9`.
- **Status wdrożenia frontendu:** testy GitHub Actions dla najnowszego zestawu zmian wymagają potwierdzenia. Przed zakończeniem pracy zmienić fingerprint w `src/routes/__root.tsx`, poczekać na zielony workflow Cloudflare, a następnie odczytać Worker produkcyjny i sprawdzić fingerprint. Nie uznawać frontendu za wdrożony przed tym testem.
- Następny krok po potwierdzeniu deployu: kontynuować audit brakujących krajów/lig z katalogu FootyNomad; nie powtarzać naprawionych aliasów. Nie uruchamiać ręcznie skanera poza cooldownem scheduler'a. Issue #76 pozostaje otwarte.


### Końcowa weryfikacja wdrożenia sześciu aliasów — 2026-11-17 03:41 UTC
- Cloudflare workflow **#642**, run ID `44011804234`, commit `69401e85aa221d2d0058064b2a82adad4d1aca0e`, zakończył się **SUCCESS**. Potwierdzone wszystkie kroki: Deno type-check, Vitest, TypeScript, Cloudflare build i Deploy to Cloudflare Workers.
- Produkcyjny Worker `https://moneyball-global.damianwalus3.workers.dev/?audit=six-aliases-104case` zwrócił HTTP 200. HTML zawiera dokładny fingerprint `europe-top-two-2026-11-17-six-aliases-104case` (pozycja 691). Frontend jest więc faktycznie wdrożony na MAIN/Cloudflare.
- Dodatkowa macierz 50 nazw providerowych dla lig z krajów europejskich: **50/50 PASS**; uwzględnia m.in. Gibraltar Premier Division, Albania 1st Division, Armenia First League, Azerbaijan Birinci Dasta, Belarus 1 Division i wykluczenie 2 Division, Bulgaria First/Second League, Estonia Esiliiga A/B, Faroe 1 Deild, Georgia Erovnuli Liga 2, Hungary NB I/II, Iceland 1 Deild, Ireland First Division, Israel Liga Leumit, Kazakhstan 1 Division, Latvia 1 Liga, Luxembourg National Division, Malta Challenge League, Moldova Liga 1, Montenegro First/Second League, North Macedonia First/Second League, Poland I Liga, Romania Liga II, Serbia Prva Liga, Slovakia 2 Liga i Wales FAW Championship.
- Poprzednia macierz brakujących aliasów/wykluczeń pozostaje **20/20 PASS**. Edge Functions ACTIVE: `footynomad-sync v83`, `moneyball-free-feed v40`, `moneyball-predict v236`.
- Nie przywracano Vercel. Ongoing audit pozostaje w issue #76; cały projekt MONEYBALL nie jest uznany za zakończony.


## 2026-11-17 — Full FootyNomad Europe catalog audit, Polish tier correction, production smoke test

### Provider coverage and exact league labels
- Re-read the live FootyNomad browse directory and resolved its country slugs. The provider has country pages for all 55 UEFA member associations; Bosnia is exposed as `/country/bosnia` and North Macedonia as `/country/macedonia`. Liechtenstein's directory contains only a cup, not a domestic league.
- Built a country-scoped senior men's domestic tier-1/tier-2 matrix from the actual provider labels. SQL helper result: **106/106 expected league labels accepted**.
- Built a negative matrix for cups, international competitions, women's/youth/reserve football, and tier 3+. Initial run found one real false positive: Poland's `II Liga` (third tier) matched the SQL helper's unbounded `i liga` substring.
- Corrected the country-specific exception for Poland `II Liga` / `2 Liga`, including regional labels. Kept Poland's `I Liga` (second tier) accepted.
- Final SQL regression: **106/106 positive labels accepted; 40/40 negative labels rejected**.
- Added the same Poland exception to the frontend and all three duplicated Edge scope filters. Added frontend tests for the 106 provider labels and 40 negative cases, including Poland `II Liga East/West` and `2 Liga` variants.

### Code, migration and production deploy
- Scope-fix code commit: `db047d79599acd09adcfd16704b7c178e089e8e3`.
- Applied SQL migration: `20261117043500_exclude_polish_ii_liga_from_top_two_scope.sql`; repository migration-file commit: `cef41635c3ec91eda2376341106cc82b0ef2109a`.
- Supabase Edge Functions ACTIVE after redeploy: `footynomad-sync v84`, `moneyball-free-feed v41`, `moneyball-predict v237`. Existing JWT verification settings were preserved.
- Cloudflare workflow **#647 SUCCESS** on main; CI **#1061 SUCCESS**. Production fingerprint confirmed: `europe-top-two-2026-11-17-footynomad-106case-polish-ii-liga`.
- Production Worker home, login page and PWA manifest return successfully at `https://moneyball-global.damianwalus3.workers.dev/`. Private app routes correctly require login.

### Live production data and financial checks (Europe/Brussels, 2026-11-17)
- FootyNomad feed's latest scheduled fetch returned HTTP 200 and exactly 2 eligible senior men's domestic tier-1/tier-2 fixtures for today: Rathfriland–Moyola Park and Warrenpoint Town–Glenavon FC, both Northern Ireland Championship. The broader fixture table contains lower tiers, cups, international and reserve records; the frontend and SQL scope filters keep them out of the active eligible list.
- Each eligible fixture has 12 predictions across 1X2, Double Chance and Goals. All 12 per match are `ODRZUCONY`; there are **0 selected picks**. No coupon was generated because there are only two eligible matches and no confirmed candidates. Do not fabricate a third leg or weaken the rules.
- The results sync Edge Function `moneyball-results-sync v71` is ACTIVE. Latest cron response was HTTP 200: 173 source fixtures fetched, no finished matches to settle today, financial reconciliation checked 7 coupons with 0 errors.
- Cron schedule confirmed: FootyNomad feed every 15 minutes; results sync every 5 minutes; prediction scheduler checks every minute but correctly respects its next eligible scan time of 08:00 Europe/Brussels. Do not bypass the scheduler cooldown.
- Bankroll ledger reconciles to **€84.28** across 9 transactions: €91.60 opening balance, €23.00 recorded stakes and €15.68 returns. Two €4.00 TEST coupons were won and settled; the earlier €5.00 stakes remain in the historical ledger. Future coupon stake remains €4.00.
- One historical cron startup timeout occurred at 2026-11-16 23:25 UTC; subsequent repeated runs succeeded. Current feed, results and prediction endpoints return HTTP 200.

### Remaining checks (do not mark the whole project complete)
1. After the scheduled 08:00 Brussels scan, verify that newly ingested fixtures use the corrected Poland exclusion and the full 106-label allowlist; do not manually bypass cooldown.
2. Continue live ingestion/odds coverage and verify that confirmed odds are fresh before any coupon selection.
3. On the next finished eligible match, verify result settlement, coupon payout and bankroll reconciliation end-to-end.
4. Security advisor still reports leaked-password protection disabled; enable it in Supabase Auth settings when account access permits. Keep backend-only RLS tables closed. Do not move `pg_net` out of `public` without a migration plan because the active cron jobs depend on it.
5. Keep issue #76 OPEN as the ongoing catalog/production regression tracker. The full MONEYBALL GLOBAL project is not yet declared complete.


### Kontynuacja kontroli produkcyjnej — 2026-11-17 04:46 UTC
- Potwierdzono ponownie main HEAD `65041917530b0eabc49aa7363d85b3c1b3476f0d`; CI #1062 i Cloudflare deploy #648 zakończone SUCCESS. Deploy #647 dla właściwych zmian kodu także SUCCESS; Worker produkcyjny zwraca HTTP 200, login i manifest PWA działają, a meta `league-scope-version` zawiera `europe-top-two-2026-11-17-footynomad-106case-polish-ii-liga`.
- Edge Functions nadal ACTIVE: `footynomad-sync v84`, `moneyball-free-feed v41`, `moneyball-predict v237`, `moneyball-results-sync v71`. Harmonogramy aktywne: feed co 15 min, wyniki co 5 min, predykcje sprawdzane co minutę z cooldownem.
- Ostatni feed o 04:46 UTC: 2 rekordy, 2 unikalne identyfikatory, 0 duplikatów. Dzisiejsze kwalifikujące się mecze to Rathfriland–Moyola Park i Warrenpoint Town–Glenavon FC. Każdy ma 12 wpisów prognoz (1X2, DC, gole); wszystkie 24 wpisy mają status ODRZUCONY, 0 mają kursy. Powody: brak zweryfikowanego źródła/Elo albo mniej niż 3 zweryfikowane ostatnie mecze na drużynę. To celowe zabezpieczenie przed fikcyjnym typowaniem — nie generować kuponu.
- Ograniczenie danych do rozwiązania: obecny bezkluczowy zbiór historyczny/xG nie obejmuje ostatnich meczów tych drużyn z NI Championship; źródło kursów MOVI jest wstrzymane bez klucza API. Football-Data udostępnia darmowe historyczne CSV i kursy dla części większych lig, ale nie jest dowodem pokrycia NI Championship ani całej Europy. Nie przedstawiać tego jako rozwiązanej integracji.
- Stan skanera o 04:45 UTC: ukończony, 2 batch'e, 13 fixture processed, bez błędu; następny termin 07:00 UTC = 08:00 Europe/Brussels. Oczekiwać na automatyczny skan; nie uruchamiać ręcznie i nie omijać cooldownu.
- Bankroll ponownie uzgodniony z ledgerem: **€84.28**, 9 transakcji (depozyt €91.60, stawki €23.00, zwroty €15.68). Kupony historyczne rozliczone; bieżących kuponów nie tworzyć bez zatwierdzonych kursów i typów.
- Security advisor nadal pokazuje wyłączoną ochronę przed hasłami wyciekłymi; obecne narzędzia połączenia nie udostępniają ustawienia Auth do bezpośredniej zmiany. RLS bez polityk dotyczy 5 tabel wewnętrznych (nie dodawać publicznych polityk); nie przenosić `pg_net` z `public`, bo cron używa tej funkcji.
- Następne zadania: po skanie 08:00 zweryfikować pełną listę surowych meczów FootyNomad kontra feed i predykcje; rozwiązać legalne, bezkluczowe pokrycie wyników/ostatnich 5 meczów i kursów dla wszystkich lig, szczególnie NI Championship; przy kolejnym zakończonym meczu wykonać test rozliczenia od wyniku do bankrolla. Issue #76 pozostaje OPEN. Nie deklarować pełnego zakończenia MONEYBALL GLOBAL.


### Podłączenie brakującej historii xGoalsPro — 2026-11-17 04:50 UTC
- Wykryto, że `readXgoalsTeamForm()` istniał w `moneyball-predict`, ale nigdy nie był wywoływany; `xgoalsTeamForms` pozostawała pusta. To wyjaśnia część braku historii dla niższych lig mimo dostępności publicznych stron.
- Podłączono pobieranie publicznych, bezkluczowych stron drużyn xGoalsPro do procesu prognozowania: unikalne drużyny z bieżącej partii, maks. 20 pobrań, concurrency 4, cache w `match_market_data` jako `XGoalsPro` na 6 godzin. Dane są wynikami meczów, nie xG; nie wolno oznaczać ich jako historycznego xG. Dodano aliasy slugów `Rathfriland Rangers -> rathfriland` i `Glenavon -> glenavon-fc`.
- Sprawdzone strony: Rathfriland (ostatnie wyniki 13.11, 06.11, 30.10, 20.10, 17.10 itd.), Moyola Park, Warrenpoint Town i Glenavon FC. Test parsera na rzeczywistych fragmentach HTML: Rathfriland 6 wyników i Glenavon 5 wyników poprawnie odczytanych; w produkcji pobieranie uruchomi się w następnym zaplanowanym batchu. Oficjalny NIFL potwierdza terminarz 17.11 i wyniki klubów.
- Commit `87adf3879f670660046473da89f8e902a1d28227`. CI #1064 SUCCESS, Cloudflare Worker deploy #650 SUCCESS. `moneyball-predict v238` ACTIVE (verify_jwt zachowane false jak poprzednio). Produkcyjny Worker HTTP 200.
- Nie uruchamiano ręcznie predykcji i nie omijano cooldownu. Pełny test end-to-end nowego adaptera pozostaje na następnym automatycznym skanie o 08:00 Europe/Brussels (07:00 UTC). Po nim zweryfikować `XGoalsPro` cache, `xgoals_home_matches/away_matches`, source i liczbę zaakceptowanych/odrzuconych prognoz.
- Nadal nierozwiązany oddzielny problem kursów: obecnie 0/24 prognoz dzisiejszych dwóch meczów ma potwierdzony kurs. Nie tworzyć kuponów bez aktualnych, źródłowo potwierdzonych kursów; nie wykorzystywać cen z predykcyjnych stron zewnętrznych jako kursów bukmacherskich.
- Ongoing: integracja bezkluczowych wyników dla pozostałych lig europejskich, legalne pokrycie kursów (szczególnie mniejszych lig), test rozliczenia po następnym meczu. Issue #76 nadal OPEN; MONEYBALL GLOBAL nie jest jeszcze w całości zakończony.


### Regresja slugów OpenMatchday — wykluczenie angielskich lig od 3. poziomu (2026-11-17 05:00 UTC)
- Kontrola surowych rekordów na 17.11 wykazała 109 meczów w tabeli matches; 54 to młodzież/U17-U23, a cztery mecze z ENG_7_northern-premier-league błędnie przechodziły dotychczasowy allowlist, ponieważ nazwa zawierała fragment „premier league”. Wcześniejszy raport o 2 meczach w zakresie był prawidłowy dla FootyNomad, ale pomijał te 4 rekordy OpenMatchday.
- Nie usuwano surowych rekordów z bazy. Naprawiono filtr we frontendzie (src/lib/domain.ts), testach (src/lib/domain.test.ts), moneyball-predict, moneyball-free-feed i footynomad-sync: dla kraju ENG/England tylko slugi ENG_1_* i ENG_2_* są dopuszczone; ENG_3_* i wyższe odrzucane.
- Migracja 20261117045600_exclude_openmatchday_english_tier3_plus_slugs.sql zastosowana w produkcyjnej bazie. Test SQL: ENG_1 Premier League=true, ENG_2 Championship=true, ENG_3 League One=false, ENG_6 National League North=false, ENG_7 Northern Premier League=false, standardowy Premier League=true, National League North=false, Northern Ireland Championship=true.
- Po migracji produkcyjny SQL helper kwalifikuje dokładnie 2 mecze na 17.11: Warrenpoint Town–Glenavon FC i Rathfriland–Moyola Park. Cztery nieprawidłowe mecze OpenMatchday nie są już zaliczane do zakresu.
- CI Moneyball #1071 / run 44020770673: SUCCESS. Cloudflare deploy #657 / run 44020770843: SUCCESS. Produkcyjny Worker root odpowiada HTTP 200.
- Edge Functions ACTIVE: moneyball-predict v239 (verify_jwt=false zachowane), moneyball-free-feed v42, footynomad-sync v85. Bezpośredni odczyt potwierdził nowy filtr w każdej z trzech funkcji.
- Nie uruchamiano ręcznego prediction scan ani nie obchodzono cooldownu. XGoalsPro cache nadal wymaga potwierdzenia podczas zaplanowanego skanu 08:00 Europe/Brussels; do tego czasu nie oznaczać adaptera jako zweryfikowanego end-to-end. Nadal brak potwierdzonych kursów dla dzisiejszych meczów — bez kuponu bez aktualnych cen. Bankroll ledger pozostaje €84.28. Issue #76 pozostaje OPEN; projekt nie jest zakończony.


### Preflight xGoalsPro i ponowna kontrola kursów — 2026-11-17 05:05 UTC
- Przed automatycznym skanem 08:00 pobrano dokładnie te cztery publiczne URL-e xGoalsPro, których używa adapter: Northern Ireland / Rathfriland, Moyola Park, Warrenpoint Town i Glenavon FC. Każda strona zwróciła sekcję Latest results i parser-equivalent odczytał po 10 ostatnich wyników (łącznie 40 wpisów); przykładowo Rathfriland 13.11 2–0 H&W Welders, Glenavon 13.11 1–6 przeciwnik. To jest pozytywny test źródła i parsera, ale nie zastępuje testu zapisu do produkcyjnego cache podczas skanu.
- Ponowny audyt kursów: provider_odds ma 0 niesuspendowanych prematch cen z ostatnich 6h. WeekendGoals informuje, że dla Warrenpoint Town–Glenavon żaden śledzony sprzedawca nie ma wycenionej oferty. Oddslot pokazuje jedynie algorytmiczne prawdopodobieństwa i formę, nie kursy bukmacherskie. Bwin/Unibet Belgium/Ladbrokes Belgium nie zwróciły cen dla tych spotkań. Nie przekształcać prognoz 45%/35% itp. w kursy i nie tworzyć kuponu.
- Po tej kontroli stan pozostaje: 2 kwalifikujące się mecze, 0 kursów, 0 rekordów XGoalsPro w cache przed planowanym skanem. Następny skan 07:00 UTC = 08:00 Europe/Brussels. Nie wywoływać ręcznie predykcji ani nie obchodzić cooldownu.
- Docs CI #1072 i Cloudflare deploy #658 zakończone SUCCESS. Wersje produkcyjne pozostają moneyball-predict v239, moneyball-free-feed v42 i footynomad-sync v85. Bankroll €84.28. Issue #76 OPEN.


## Kontynuacja audytu przed skanem 08:00 — 2026-11-17 05:27 UTC (06:27 Europe/Brussels)
- Stan schedulera potwierdzony w produkcji: cron job moneyball-global-auto-predict-sequential jest aktywny co minutę. net._http_response potwierdza, że wywołania moneyball-predict v239 kończą się HTTP 200 i jawnie zwracają skipped=true, reason=cooldown, next_scan_at=2026-11-17T07:00:00Z. Nie jest to pełny skan; nie uruchamiać ręcznie przed terminem.
- Cron moneyball-global-free-footynomad aktywny co 15 min. Odpowiedź z 05:16 UTC: FootyNomad, reported_total=2, fixtures_count=2, inserted=0, updated=2, schedule=08:00 i 15:00 Europe/Brussels. Dwa mecze pozostają Warrenpoint Town–Glenavon FC oraz Rathfriland–Moyola Park.
- Cron wyników aktywny co 5 min. Odpowiedź z 05:25 UTC: fixtures_fetched=173, matches_matched=0 w głównym dopasowaniu, alternate_results_fetched=3, alternate_results_matched=3, errors=[], financial_reconciliation checked=7, failed=0. Dzisiejsze mecze są przed rozpoczęciem, więc brak rozliczeń jest oczekiwany.
- xGoalsPro: cache produkcyjny nadal 0 wierszy przed skanem; dokładny parser v239 został wcześniej zweryfikowany na czterech bieżących stronach (po 10 wyników na zespół). Weryfikacja DB cache dopiero po batchu 08:00.
- Potwierdzona blokada kursów: publiczny GET moneyball-movi-odds-sync zwraca key_configured=false. Cron moneyball-movi-odds-every-30m jest nieaktywny; MOVIODDS_API_KEY nie jest ustawiony. provider_odds ma 0 świeżych niesuspendowanych kursów prematch w ostatnich 24h. Nie włączać sync bez credentialu i nie generować sztucznych cen.
- Research alternatyw no-key: Odds-API.io udostępnia bez klucza wyłącznie katalog sportów/bookmakerów/rynków; właściwe odds/events wymagają klucza, a darmowe klucze dla nowych kont są wstrzymane. OddsPapi oferuje bezpłatny limit 250 requestów/miesiąc bez karty, ale nadal wymaga API key — nie wdrażano, zgodnie z ograniczeniem projektu „bez API keys”. OddsPortal jest publicznym porównywaczem, ale nie potwierdzono oficjalnego publicznego API ani licencji na automatyczne pobieranie; nie dodawać scrapera jako źródła produkcyjnego bez jasnych uprawnień.
- Aktualny stan: 2 kwalifikujące się mecze, 24 predykcje ODRZUCONY, 0 kursów, 0 WYBRANY; bankroll €84.28. Nie tworzyć kuponów. Następny bezpieczny krok: sprawdzić po 08:00, czy scheduler rozpoczął batch, czy XGoalsPro zapisał cache i czy coverage/powody odrzucenia się zmieniły. Issue #76 pozostaje OPEN; projekt nieukończony.


### Audyt advisorów Supabase — 2026-11-17 05:31 UTC
- Security advisor: 5 tabel z RLS włączonym bez policy (`match_result_sources`, `moneyball_password_recovery`, `moneyball_prediction_scan_state`, `moneyball_reschedule_sync_state`, `project_work_log`). To są tabele backendowe/operacyjne; nie dodawać szerokich policy dla anon/authenticated tylko po to, aby wyzerować lint. Zweryfikować osobno role/granty i dostęp funkcji service-role przed ewentualną zmianą.
- Security advisor: `pg_net` w schemacie public (WARN). Nie przenosić extension bez migracji wszystkich zależnych cronów i testu `net.http_post/get`; obecne harmonogramy używają `net`.
- Security advisor: Leaked Password Protection wyłączone (WARN). Dostępne narzędzia nie udostępniają konfiguracji Supabase Auth do bezpiecznej zmiany; pozostawić jako otwarty punkt do włączenia w Supabase Dashboard → Auth → Password Security, bez zmiany haseł użytkowników.
- Performance advisor: 24 nieużywane indeksy (INFO), w tym część indeksów legacy/finansowych i skanera. Nie usuwać ich automatycznie: część może obsługiwać rzadkie operacje rozliczeniowe, raporty albo ścieżki po wdrożeniu. Wymagany osobny audyt `pg_stat_user_indexes` + EXPLAIN na reprezentatywnych zapytaniach przed DROP.
- Health advisor: brak zgłoszonych problemów. Nie wykonano zmian schematu ani polityk na podstawie samych ostrzeżeń.


### Naprawa europejskiego importu i automatycznego skanu — 2026-11-17
- Zakres bez zmian: wyłącznie produkcyjny MONEYBALL GLOBAL MAIN, repo `damianwalus3-jpg/moneyball-global`, branch `main`, Cloudflare Worker produkcyjny. Nie dotykano TEST/Vercel i nie cofnięto wcześniejszych napraw.
- Potwierdzona przyczyna braku meczów: katalog OpenMatchday używa identyfikatorów folderów w formacie `<COUNTRY>_<TIER>_<slug>` (np. poziom 1/2), ale dotychczasowy importer przekazywał ten techniczny identyfikator jako nazwę rozgrywek do allowlisty nazw lig. W efekcie prawidłowe mecze były odrzucane przed zapisem. Frontend i silnik predykcyjny korzystały z osobnych filtrów, które również nie rozpoznawały metadanych poziomu ligi.
- `moneyball-public-sources`: parser katalogu odczytuje teraz nazwę ligi i kraju z indeksu, ogranicza pobieranie do europejskich krajowych folderów poziomu 1/2, wyklucza UEFA/puchary/kobiety/młodzież/rezerwy, zachowuje folder źródłowy w `external_id` i `source_competition_id`. Naprawiono również wyznaczanie folderów historii i mapowanie nazw krajów, aby normalizacja ligi nie zerowała historii drużyn.
- `footynomad-sync`: dodano rozpoznawanie zweryfikowanych folderów OpenMatchday poziomu 1/2; źródła są łączone po dacie i parach drużyn, a nie po dosłownej nazwie ligi (różne aliasy nie tworzą duplikatów). Odpowiedź importu raportuje też liczbę meczów OpenMatchday.
- `moneyball-predict`: filtr predykcyjny rozpoznaje poziom ligi z identyfikatora OpenMatchday i odrzuca UEFA jako rozgrywki ponadnarodowe. Najważniejsza dodatkowa naprawa: pierwsza strona automatycznego skanu importuje dzisiejsze rekordy z `moneyball_global_fixture_feed` (FootyNomad) i `moneyball-public-sources` przed odczytem strony predykcji; import jest ograniczony do dzisiejszych europejskich męskich lig poziomu 1/2 i deduplikuje po dacie oraz parach drużyn. Wynik zwraca metryki `scheduled_import`. Kolejne strony skanu nie powtarzają importu.
- Frontend `src/lib/domain.ts`: ekran Mecze akceptuje OpenMatchday wyłącznie, gdy źródłowy folder potwierdza poziom 1/2 i kraj jest europejski; nadal odrzuca poziom 3+, UEFA, puchary, kobiety, młodzież i rezerwy.
- Testy regresyjne: OpenMatchday BEL_1 i BEL_2 są akceptowane; ENG_3, UEFA, puchary i ligi kobiece są odrzucane; Northern Ireland Championship (FootyNomad) jest akceptowany, a English National League North odrzucana.
- Rzeczywisty katalog OpenMatchday ma 75 rozgrywek łącznie; obecny katalog zawiera 38 europejskich krajowych lig poziomu 1/2. To nadal nie jest pełne pokrycie wszystkich krajów Europy — nie wolno raportować 38 jako kompletnej Europy. Rozszerzenie brakujących lig pozostaje otwartym zadaniem.
- Baseline bazy przed porannym skanem (17.11.2026, ok. 06:00 UTC): `match_market_data` zawierało 2 rekordy XGoalsPro z dzisiejszym znacznikiem czasu; utworzono 265 predykcji, z czego 217 miało `xgoals_public_results`, a 265 miało niepuste `data_source` i `rationale`. `moneyball_global_fixture_feed` zawierał 2 dzisiejsze mecze FootyNomad. W `matches` było 11 dzisiejszych rekordów OpenMatchday, z czego 0 miało folder poziomu 1/2, a 11 pochodziło z niższych poziomów. Stare rekordy źródłowe zachowano; ograniczono ich widoczność i udział w predykcjach filtrami, bez kasowania historii.
- Kontrola kalendarza 17.11: główne rozgrywki krajowe mają przerwę reprezentacyjną; publiczne terminarze pokazują przede wszystkim UEFA Nations League i mecze międzynarodowe, które są poza zakresem aplikacji. Spotkanie Albacete–Celta Vigo B było 16.11 CET, nie 17.11. Niewielka liczba kwalifikujących się meczów dzisiaj nie jest sama w sobie dowodem braku importu.
- Wdrożenia: Cloudflare Worker deploy #680 SUCCESS; CI #1094 SUCCESS (Deno type-check Edge Functions, TypeScript, build, 61/61 testów). Supabase Edge Functions ACTIVE: `moneyball-public-sources v61`, `footynomad-sync v86`, `moneyball-predict v240`; ustawienia `verify_jwt` zachowano.
- Audyt po skanie o 08:15 (Europe/Brussels) rozszerzono o kontrolę `scheduled_import`, liczby feed/public/eligible/inserted, deduplikacji i porównanie do powyższego baseline. Wynik runtime po skanie pozostaje do potwierdzenia; samo wdrożenie nie oznacza zaliczenia testu.
- Główne commity naprawy: `007b73978ab2` (import przed automatycznym skanem) oraz `84751ff55c92` (testy regresyjne); pełna seria zmian znajduje się w historii branch `main`.


### Telemetria importu przed skanem — 2026-11-17 06:06 UTC
- Dodatkowo `moneyball-predict v241` zapisuje w logach JSON `scheduled_import` z polami `ok`, `feed_rows`, `public_rows`, `eligible_rows`, `inserted`, `skipped_existing`, `deduplicated_candidates`, `source_counts`, `feed_error` i `public_source_error`. Wymagany jest jawny `source`, `external_id`, liga i nazwy obu drużyn; importer nie podstawia domyślnego źródła.
- CI #1099 SUCCESS, 61/61 testów, Deno type-check, TypeScript i build SUCCESS. Cloudflare Worker deploy #685 SUCCESS. Supabase: `moneyball-predict v241 ACTIVE`, `moneyball-public-sources v61 ACTIVE`, `footynomad-sync v86 ACTIVE`.
- Produkcyjny `moneyball_prediction_scan_state` dla 17.11 ma `next_scan_at=2026-11-17 07:00 UTC` (08:00 Europe/Brussels). Poprzedni skan jest completed; claim nowego skanu resetuje kursor, więc importer uruchomi się na pierwszej stronie nowej partii. Nie wymuszano skanu i nie obchodzono cooldownu.


### Bieżący audyt produkcyjny — 2026-11-17 07:37 Europe/Brussels
- Korekta wcześniejszej interpretacji: 265 rekordów predykcji widocznych w danych z 17.11 lokalnie pochodzi ze starszych wersji modelu (m.in. MONEYBALL GLOBAL 3.8/3.2), utworzonych poprzedniej nocy przed wdrożeniem v241. Przykłady UEFA Nations League, Lowland League, National 2 i ENG_7 są historycznymi rekordami poza zakresem, a nie dowodem, że aktualny v241 wygenerował je ponownie. Nie usuwać ich.
- Produkcyjny helper SQL `moneyball_is_european_top_two_league(text,text)` sprawdzony na wszystkich 98 surowych rekordach FootyNomad dla 17.11 Brussels: dokładnie 2 kwalifikujące się mecze. Są to Warrenpoint Town–Glenavon FC oraz Rathfriland–Moyola Park, Northern Ireland Championship. Oba rekordy są obecne w feedzie i tabeli `matches`. Brak dzisiejszych rekordów OpenMatchday w tym zakresie czasu.
- Frontend `mecze.tsx` filtruje mecze przez `isEligibleEuropeanMatch`; Statistics i kupony korzystają ze wspólnego helpera ligi europejskiej top-2. Nie kasować historycznych meczów/predykcji — pozostają w bazie, ale powinny być wyłączone z widoków i obliczeń zakresowych.
- 07:37:24 Europe/Brussels: cron predykcji jest aktywny co minutę, ale do 08:00 zwraca HTTP 200 i `skipped=true / cooldown`, `next_scan_at=07:00 UTC`. Nie omijać blokady. Metryka `scheduled_import` dla nowego skanu jeszcze nie powstała; rzeczywisty przebieg v241 pozostaje do zweryfikowania.
- Feed FootyNomad: 2 mecze, ostatnie odświeżenie 07:31 Brussels, 0 duplikatów, oba mecze już w `matches`. Cache xGoalsPro: 2 świeże wiersze (06:38 Brussels) oraz 10 rekordów MONEYBALL_PUBLIC_AGGREGATOR. Potwierdza to zapis cache, ale nie zastępuje kontroli, czy konkretne dwie kwalifikujące się drużyny mają użyteczną historię w predykcji.
- Warunek następnego etapu: po rozpoczęciu batcha 08:00 odczytać JSON `scheduled_import`, potwierdzić 2 kwalifikujące się mecze, świeże źródła i uzasadnienia, wynik modelu, widoczność w UI, aktualne kursy oraz rozliczenie stawki €4. Projekt nadal NIE jest ukończony.


### Manual odds promotion repair and production validation — 2026-11-17
- Znaleziono dead-end w `OddsForm`: poprzedni warunek promocji wymagał `confidence >=55`, ale model celowo zapisuje `confidence:null` (pokrycie danych to nie kalibrowana pewność). Typ ODRZUCONY wyłącznie z powodu braku kursu nie mógł być zatwierdzony ręcznym kursem.
- Dodano `canPromoteManualOdds`: wymaga powodu odrzucenia wyłącznie z braku kursu, prawdopodobieństwa >75%, `model_coverage>=55`, historii min. 3 mecze każdej drużyny, źródła modelu innego niż baseline, niepustego źródła i uzasadnienia, przyszłego meczu, europejskiej ligi mężczyzn poziomu 1/2, poprawnego rynku/typu i wykluczenia rezerw. Ręczny kurs wymaga poprawnego URL HTTP(S) oraz czasu zapisu nie starszego niż 6 h. Niezweryfikowane/stare wpisy dostają status MISSING.
- `moneyball-predict` zapisuje teraz `model_coverage` i `model_source_type` w 1X2/DC i GOALS. Manualne zatwierdzanie nie korzysta z pola confidence.
- CI #1110: SUCCESS; Deno Edge Functions type-check, 65/65 testów, TypeScript i build. Cloudflare deploy #696: SUCCESS, commit `e339232717ca0d4db57a81caa84e1e1dffe0380c`. Smoke fetch publicznego Worker MAIN zwrócił MONEYBALL GLOBAL 2.0 i oczekiwany panel (€4, 1X2, DC, Gole, kupony, rozliczenia); latency 1.44 s nie jest pomiarem zalogowanej interakcji UI.
- Supabase production `moneyball-predict v242` ACTIVE, `verify_jwt=false` bez zmiany poprzedniej konfiguracji. Trzeba potwierdzić, że kolejny scheduled batch zapisuje nowe pola coverage; dopiero potem uznać manual odds E2E za sprawdzony.
- Korekta semantyki XGoalsPro: bieżące rekordy dla dwóch kwalifikujących się meczów zawierają ostatnie 10 wyników i gole zdobyte/stracone, ale nie zawierają `xg_for` ani `xg_against`. To forma/wyniki, a nie pomiar xG. Dla tych danych model ma raportować `xg_used=false`, chyba że inne źródło dostarczy rzeczywiste xG.
- Kursy: MoviOdds bez klucza; `provider_odds` ma 219 022 historyczne rekordy, ale 0 świeżych, niesuspendowanych prematch quote w 6 h. Bwin/Kambi probe zwracają 404. Bwin Sports API jest udokumentowane jako API partnerskie, nie potwierdzono anonimowego źródła bez klucza. Nie dodawać scrapera stron bukmacherów bez uprawnienia. Przy ograniczeniu bez API keys obsługiwany fallback to ręczny kurs z URL i czasem. Bez świeżego, źródłowego kursu nie tworzyć kuponu.
- Projekt nadal NIE ukończony. Po 08:00 Europe/Brussels należy sprawdzić `scheduled_import`, 2 kwalifikujące się mecze, coverage predykcji, flagi rzeczywistego xG, dostępność kursów i integrację kuponu/bankrolla.


### Dodatkowe utwardzenie kursów ręcznych i codzienny audyt — 17.11.2026 07:50 Brussels
- Formularz ręcznego kursu blokuje zapis bez poprawnego URL HTTP/HTTPS z hostname i pokazuje błąd przy polu. Wcześniej URL był tylko etykietą; brak adresu zapisywał kurs, który nie mógł zatwierdzić prognozy.
- Commit `d57240977ef241e445139f5a260cdefdde95d79d`: Moneyball CI #1119 SUCCESS (Deno, testy, TypeScript, build); Cloudflare deploy #705 SUCCESS. Publiczny smoke test Worker MAIN nadal zwraca MONEYBALL GLOBAL 2.0 i panel stawki 4 EUR. Poprzedni commit `c9fed7133353824415fe9ecad913a41fa610f1a0` również CI #1118 i deploy #704 SUCCESS.
- Jednorazowy audyt po skanie zmieniony na codzienny audyt 08:15 Europe/Brussels od 18.11.2026. ID `6afbeb034e4c81919dd6ad7d554497e0`. Audyt kontroluje scheduled_import, zakres europejskich męskich lig 1/2, model coverage vs verified market, prawdziwe xG, świeżość i URL kursu, stawkę/zwrot 4 EUR, kupony, idempotencję, CI/deploy i zapisuje raport w obu dokumentach. Codzienny skan 08:00 pozostaje aktywny.
- 07:50 Brussels 17.11: zaplanowany skan 08:00 jeszcze się nie rozpoczął; next_scan_at=07:00 UTC. Nie wymuszać. Feed FootyNomad ma 2 wiersze, 0 statusów NS/upcoming w tym momencie. Ocenę importu zrobić po scheduled_import.
- Publiczny TipsAudit feed sprawdzony: 292 globalne mecze, w tym stare fair snapshots i bieżące mecze międzynarodowe. Fair odds to prawdopodobieństwa rynkowe bez marży, nie kurs wypłaty bukmachera. Atrybucja jest wymagana; PredictionsView pokazuje widoczny link TipsAudit i zastrzeżenie, że fair odds nie są ofertą bukmachera. Nie używać fair odds do kuponów.
- Bwin/Kambi Edge Functions są ACTIVE, ale ich kod celowo zwraca 404; nie są działającymi feedami. MoviOdds aktywne, ale bez MOVIODDS_API_KEY. Nie scrapować bukmacherów i nie wpisywać fikcyjnych kursów. Obecny fallback: ręczny kurs z URL.
- Projekt pozostaje w toku; następny warunek to udany zaplanowany skan oraz testy E2E po zalogowaniu.


## Audyt produkcji i poprawka zakresu statystyk — 17.11.2026 08:00–08:05 Brussels
- Skan dzienny zakończył się: 1 batch, 2 mecze, status completed, brak last_error; kolejny batch zaplanowany na 15:00 Brussels.
- Baza miała 98 meczów z datą 17.11, ale tylko 2 spełniły SQL-owy filtr lig europejskich poziomu 1/2 i płci męskiej: Warrenpoint Town–Glenavon FC oraz Rathfriland–Moyola Park. Pozostałe 96 rekordów to mecze spoza zakresu, zachowane w bazie.
- Dwa kwalifikujące się spotkania mają predykcje w trzech rynkach, ale wszystkie typy są ODRZUCONY: część przez próg >75%, część przez brak aktualnego potwierdzonego kursu. Nie wymuszać kuponów.
- Kursy: 219 022 historycznych rekordów, 0 świeżych niesuspendowanych ofert w ostatnich 6 h. xG: brak rzeczywistych obserwacji xG dla tych meczów; dane XGoalsPro to ostatnie wyniki i gole. Brak potwierdzonych składów/kontuzji.
- W logach z ostatnich 24 h: moneyball-predict 957 requestów, 8 HTTP 5xx, średnia 2.1 s, p95 4.6 s, max 30.5 s; moneyball-results-sync 287 requestów, 0 5xx, średnia 7.5 s, p95 13.5 s, max 26.8 s; moneyball-free-feed 98 requestów, 0 5xx; moneyball-movi-odds-sync 14 requestów, 3 HTTP 5xx. Priorytet audytu: błędy predykcji i MoviOdds oraz opóźnienia synchronizacji wyników.
- Znaleziono błąd zakresu statystyk: warstwa DB i UI statystyk używały wyłącznie filtra ligi, pomijając jawne `gender` i drużyny rezerwowe. Obie warstwy przełączono na kanoniczne `isEligibleEuropeanMatch(match)`:
  - commit `8f7f83074aca56be7ecf031aa5ba1109d3280d2a` — filtrowanie w zapytaniu statystyk;
  - commit `6a408f8a7fe9b3352744de4e1ac58023fdd784c9` — identyczny filtr w UI.
  - Istniejący test domenowy potwierdza odrzucenie `gender=women`; poprawka usuwa rozjazd między statystykami a ekranem Mecze.
- CI/produkcja: status Vercel nie jest dowodem deployu Cloudflare. Dla tych dwóch commitów nie ma jeszcze potwierdzonego CI SUCCESS ani Cloudflare deploy SUCCESS. Nie oznaczać poprawki jako wdrożonej.
- `MONEYBALL GLOBAL 3.8` to wersja modelu predykcji, a Supabase Edge Function `v242` to numer wdrożenia funkcji — różne numeracje.
- Projekt nadal w toku. Nie zmieniać zakresu lig ani reguł kuponów; nie usuwać historii; nie tworzyć kuponów bez aktualnego kursu.

## Naprawa 401 źródeł publicznych — 17.11.2026 08:10 Brussels
- Logi pierwszego skanu v242 pokazały `Public sources HTTP 401`. Potwierdzona przyczyna: nowy klucz secret/service był wysyłany jako `Authorization: Bearer`, a funkcja `moneyball-public-sources` miała `verify_jwt=true`; gateway nie widział prawidłowego JWT (`jwt_role=""`) i blokował żądanie przed handlerem.
- `moneyball-public-sources` agreguje wyłącznie publiczne dane i nie zwraca danych prywatnych, dlatego wdrożono ją jako ACTIVE v62 z `verify_jwt=false`. Dodano trwałą konfigurację w `supabase/config.toml` (commit `48e390e87ee68c2030641b6dfe1a609f4993abf4`).
- W `moneyball-predict` usunięto secret bearer z wywołania publicznego endpointu; zostaje tylko publishable `apikey`. Usunięto nieużywany global `CRON_JWT_TOKEN`. Commit `9d71b6e01e5f84f364eb41bb8fc8c464cf9094553`; produkcyjna funkcja `moneyball-predict` ACTIVE v243, `verify_jwt=false` (weryfikacja tokenu harmonogramu w handlerze pozostaje).
- Test endpointu publicznego: GET 17.11 zwrócił sukces, `ok=true`, `source_count=4`, 11 surowych i 8 europejskich fixture rows. OpenMatchday sprawdził 38 kwalifikujących się folderów, ale nie zwrócił meczów na tę datę; 8 fixture rows ma formę, 0 ma Elo, prawdziwe xG, składy, kontuzje lub kursy. To potwierdza działanie endpointu, nie pełne pokrycie lig.
- Weryfikacja E2E wywołania z cron pozostaje otwarta do kolejnego skanu o 15:00 Brussels: oczekiwane `public_source_error=null` i brak 401. Nie wymuszać skanu.
- 500 z 16.11 pochodziły ze starych wersji funkcji 217/218 (invalid cron token i permission denied dla `moneyball_cron_owner_id`); monitorować bieżące wersje oddzielnie.

## Utwardzenie hooków React w statystykach — 17.11.2026
- Audyt statyczny wykrył, że `Statystyki` wywoływały `useMemo` dopiero po wczesnym return dla loading/error. Mogło to zmieniać liczbę hooków między renderem początkowym a renderem z danymi.
- Przeniesiono `useMemo` oraz bezpieczne wartości domyślne nad wszystkie wczesne returny; zachowano dotychczasowy UI loading/error i logikę statystyk.
- Commit `e5fe44f5f61072c59603168694b12bfaaa3dc922`; kod pobrany ponownie z GitHub i potwierdzono bezwarunkowe wywołanie hooka. Status Vercel pokazuje build-rate-limit failure; nie jest to potwierdzenie ani zaprzeczenie wdrożenia Cloudflare. Brak potwierdzonego CI SUCCESS/Cloudflare deploy dla tego commitu.


## 17.11.2026 08:12–08:18 Brussels — samodzielna aplikacja, stawka 4 EUR i audyt bezpieczeństwa

- Potwierdzono znaczenie wymagania „oddzielna / niezależna aplikacja”: własny kod i interfejs w repo `damianwalus3-jpg/moneyball-global`, jeden istniejący Worker Cloudflare MAIN, bez Lovable, Vercel, TEST, nowej aplikacji i nowej bazy. Supabase `gzgeklcukrclgwbsmbsp` pozostaje backendem Auth/Postgres; użytkownik korzysta z jednego adresu aplikacji, nie musi otwierać Supabase.
- Utworzono `docs/PROJECT_CONTEXT_INDEX.md` — chronologiczny indeks kluczowych decyzji i rozmów projektu. Przed kolejną sesją czytać indeks razem z `PROJECT_STATE.md` i tym rejestrem. To indeks istotnej historii i dowodów, nie obietnica dostępu do każdego surowego transkryptu.
- MoviOdds: commit `08592e9dbd6c69e1c436d09773fed0b46eb2209b` dodaje bezpieczny guard: po walidacji tokenu cron, brak `MOVIODDS_API_KEY` zwraca HTTP 200, `ok:true, skipped:true`, bez zapytania do dostawcy i bez zmian kursów. CI, deploy GitHub i Cloudflare Worker build — SUCCESS. Supabase `moneyball-movi-odds-sync v7 ACTIVE`. GET health potwierdza `key_configured:false`; ścieżka POST skipped jest wdrożona, ale nie była bezpośrednio wywołana w audycie bez prywatnego tokenu cron.
- Stawka: produkcyjna kolumna `predictions.stake` miała default 5.00 EUR mimo aktualnej reguły 4 EUR. Zastosowano migrację `20261117071516_align_moneyball_pick_stake_defaults_to_four_eur`: default 4.00, fallback funkcji kuponu 4.00, komentarze kolumn zaktualizowane. Zweryfikowano `column_default=4.00`; żadnych istniejących rekordów nie aktualizowano.
- Migration file jest w repo pod tą samą wersją. Commit `2999e5e`: przy ręcznej promocji odrzuconej prognozy do WYBRANY ustawia 4 EUR i przelicza potential_return. Commit `26c790e`: ręczne tworzenie prognozy zapisuje 4 EUR; promocja starej odrzuconej prognozy ustawia 4 EUR; edycja już wybranego starego typu zachowuje historyczną stawkę.
- Commit `d521581b374fe77ba504a424bece485c768ad32d` zawiera kod + migrację; walidacja CI zakończyła się SUCCESS, deploy Cloudflare był w toku o 08:17. Następny commit z indeksem rozmów `26978d1b20de475269b3fe98864ba155f0e8e341` uruchamia nowy workflow — sprawdzić jego status przed deklaracją wdrożenia.
- Audyt bazy: 18 935 predykcji. 13 wybranych rekordów ze stawką 0 EUR to stare testowe typy UEFA Nations League z 16.11 (poza aktualnym zakresem), 17 wybranych rekordów ze stawką 5 EUR to historyczne typy z 13–16.11. Istnieją kupony 5 EUR i 4 EUR. Nie przepisywać żadnej historii; nowe typy/kupony mają mieć 4 EUR.
- E2E nowej stawki nie jest jeszcze zakończone: trzeba sprawdzić nową promocję/utworzenie typu przez odds → settlement → statystyki oraz nowy kupon przez ledger, bez fabrykowania produkcyjnych danych.
- Supabase project ACTIVE_HEALTHY. Health advisor: brak lints. Security: pięć tabel RLS-enabled/no policies (`match_result_sources`, `moneyball_password_recovery`, `moneyball_prediction_scan_state`, `moneyball_reschedule_sync_state`, `project_work_log`); privilege check: anon/authenticated bez SELECT, service_role z SELECT — to celowe tabele serwisowe, nie dodawać publicznych policies.
- Pozostałe security warnings: leaked-password protection disabled; rozszerzenie `pg_net` w schemacie public. Performance advisor: 24 unused indexes; nie usuwać bez testu obciążenia i EXPLAIN, bo część to świeżo dodane indeksy. Nie zastosowano niebezpiecznych zmian.
- Dokumentacja zewnętrzna sprawdzona: Supabase auth headers / securing Edge Functions / Postgres indexes i Cloudflare Wrangler deploy. Linki są w PROJECT_STATE.


## 17.11.2026 08:19 Brussels — potwierdzenie release i ciągłości projektu
- Commit MAIN `86874887068d9b8052df10fe547f08aab4f6d14a`: Moneyball CI validate run `44037653263` SUCCESS (Deno, testy, TypeScript, build), Cloudflare production deploy run `44037653210` SUCCESS.
- Po deployu Worker root odpowiada i pokazuje MONEYBALL GLOBAL 2.0 oraz 4 EUR; `/login` renderuje formularz logowania; `/panel` bez sesji zwraca login_required. To smoke test public shell/login/protected route, nie test zalogowanego panelu ani E2E.
- Supabase aktywne: public-sources v62, predict v243, movi-odds-sync v7. Movi GET health potwierdza `key_configured=false`. Połączenie predykcji v243 z public-sources v62 wymaga jeszcze następnego skanu 15:00 Brussels i `public_source_error=null`.
- Ponowne advisors po migracji: Health bez lints; security warnings bez zmian; 24 unused indexes INFO. Nie dodano publicznych RLS policies i nie usuwano indeksów.
- Zaktualizowano prompt codziennego audytu `6afbeb034e4c81919dd6ad7d554497e0`: przed pracą ma czytać PROJECT_CONTEXT_INDEX, PROJECT_STATE, PROJECT_MEMORY_AND_REGRESSION_LOG i README, odzyskiwać poprzednie decyzje projektu, sprawdzać latest main/deploy i nie powtarzać potwierdzonych napraw. Harmonogram bez zmian: codziennie 08:15 Europe/Brussels, następny run 18.11.
- Projekt nadal IN PROGRESS. Brak zalogowanego E2E, nie tworzono fikcyjnych produkcyjnych meczów, typów ani kuponów.


## 17.11.2026 08:20 Brussels — weryfikacja dodatkowych darmowych źródeł terminarza
- Sprawdzono dodatkowe źródła zanim uznano 2 mecze FootyNomad za błąd importu:
  - OpenFootball football.json 2026/27 ma tylko 8 plików ligowych: Anglia poziom 1 i 2, Niemcy poziom 1, Hiszpania poziom 1, Francja poziom 1, Włochy poziom 1, Holandia poziom 1, Portugalia poziom 1. Nie daje szerokiego pokrycia europejskich poziomów 2. Sprawdzone pliki nie zawierały spotkań 17.11. README projektu ostrzega, że upstream Football.TXT nie jest automatycznie aktualizowany codziennie; codzienny refresh mirror nie gwarantuje świeżości upstream. Nadaje się tylko jako niskopriorytetowy fallback terminarza z kontrolą świeżości, nie live/status/xG/odds.
  - Oficjalna dokumentacja TheSportsDB: darmowy klucz 123, 30 req/min i limit 3 zdarzeń dla eventsday. Test 17.11 zwrócił dokładnie 3 mecze UEFA Nations League (Walia–Portugalia, Dania–Norwegia, Ukraina–Gruzja), bez krajowych lig. Nie nadaje się jako pełne źródło fixture przy darmowych limitach; może pozostać źródłem uzupełniającym wyniki.
  - OpenMatchday ma 75 folderów i codzienne CSV, ale parser sprawdził 38 kwalifikujących się folderów EU tier1/2 i nie znalazł meczu 17.11.
  - FootyNomad ma 2 kwalifikujące się mecze krajowe. Data wypada w oknie reprezentacyjnym; niezależne źródła również nie pokazują meczów głównych lig w tym dniu. Dwa mecze mogą być realnie rzadkim dniem, nie dowodem błędu importu. Nie dopisywać UEFA/reprezentacji/pucharów/out-of-scope dla sztucznego zwiększenia liczby.
- Źródła: openfootball/europe, openfootball/football.json, oladeeayo/open-matchday, oficjalne TheSportsDB API docs. Linki zapisane w PROJECT_STATE.
- Nie dodano nowego adaptera: obecne dowody nie uzasadniają niezweryfikowanego feedu.


## 17.11.2026 08:33 Brussels — naprawa singla, integralność kuponów i bankroll
- Naprawiono martwą ścieżkę singla: UI przekazywał targetLegs:1, ale saveCouponBatch odrzucał wszystkie kupony poza 3; trigger SQL też zawsze wymuszał 3. UI nie przekazywał recordStake:true.
- src/lib/coupons.ts akceptuje teraz 1 lub 3 zdarzenia, waliduje dokładny rozmiar, >75%, różne mecze i świeże potwierdzone kursy dla MAIN/MEGA/EXTRA. Mecze zapisuje singiel jako MAIN, 1 noga, stawka 4 EUR i recordStake:true.
- Dodano test walidacji singla i wymogu rzeczywistego kursu.
- Migracja 20261117073215_allow_four_euro_main_single_pick_coupons: trigger pozwala na target_legs=1 wyłącznie dla MAIN, wszystkie typy mogą mieć 3 nogi, stawka zawsze 4 EUR. RPC rozliczeń i podsumowania finansowego już obsługiwały 1 i 3.
- Produkcyjne testy SQL tylko w transakcji rollback:
  - Singiel MAIN: jedna noga, trigger wymusił 4 EUR mimo wejściowych 5 EUR, wynik won, dokładnie jedna transakcja stake 4 EUR i return 7.20 EUR przy kursie1.80; wszystko wycofane.
  - Kupon 3-leg MAIN: 3 różne mecze, kursy 1.10×1.20×1.30, wynik won, jedna stawka4 EUR i zwrot6.86 EUR; wszystko wycofane.
  - Próba duplikatu tego samego meczu w kuponie odrzucona przez indeks unique; wszystko wycofane.
  - Po testach 0 rekordów testowych w coupons/coupon_legs/ledger.
- Commit 16348bb506953e70891d57901372023f8034e5d4: CI validate SUCCESS (Deno, testy, TS, build), deploy GitHub SUCCESS, Cloudflare Workers Build SUCCESS.
- Smoke produkcji po deployu: root 200/MONEYBALL GLOBAL 2.0, /login formularz logowania, /panel login_required bez sesji. Root 98ms, login75ms. Zalogowany E2E w przeglądarce nadal niepotwierdzony.
- Audyt kuponów: pierwszy agregat SQL zawyżył liczbę nóg i transakcji przez join dwóch relacji 1-do-wielu. To błąd zapytania, nie danych. Poprawiono analizę przez pre-aggregated CTE; nie zmieniono danych.
- Dwa aktualne 3-leg MAIN: po 3 nogi/3 różne mecze, jedna stake i jedna return na kupon; singiel historyczny: 1 noga, jedna stake i jedna return. Brak duplikatów match per coupon.
- Bankroll: 9 transakcji, depozyt91.60 EUR, stawki23 EUR, zwroty15.68 EUR, saldo84.28 EUR. Window-function audit: 0 rozbieżności balance_after. Historyczne 5 EUR i zero-stake TEST zachowane.
- Stary kupon testowy MONEYBALL AUTO TEST 2026-11-12 ma status won bez kursu i payout; podsumowanie finansowe prawidłowo oznacza payout jako incomplete. To rekord TEST, nie dopisywać fikcyjnej wygranej.
- Migracja 20261117072931_enforce_unique_match_per_coupon_leg: match_id w coupon_legs NOT NULL, unique index coupon_legs_unique_coupon_match_idx(coupon_id,match_id). Przed migracją 0 null i 0 duplikatów; bez zmiany danych. Istniejący check leg_number1–3 + unique coupon/leg_number ogranicza maksymalnie do3.
- Results-sync: commit 7f0cdffc2b7997da986229432ff341c4a712060c, wersja v72, równoległe niezależne odczyty. 3 próbki HTTP200: 5.268s (due lease), 3.887s i 4.379s (skip), 0 błędów. Discovery spadło z2.273s do0.113–0.134s; main load0.269–0.736s. v71 24h median4.594s/p95 8.76s/max13.55s. Próbka nadal mała, całkowitej latencji nie uznawać za rozwiązane.
- Otwarte: zalogowany E2E UI singla/kuponu i bankroll; skan 15:00 ma potwierdzić v243→v62 bez401; kursy bukmacherskie, real xG i potwierdzone składy nadal ograniczone.


## 17.11.2026 08:42 Brussels — final guard singla i automatyczny audyt
- Dodano guard: target_legs=1 wyłącznie dla coupon_type MAIN. Commit 2044f44 miał błąd TypeScript TS2304 (zmienna couponType poza zakresem); CI wykryło go przed deployem. Poprawiono na options.couponType w commicie a5eb5dbfbd1f6b682aa198aeebb1b8ba10c12d2c.
- Final checks a5eb5db: Deno Edge typecheck SUCCESS, 67/67 testów SUCCESS, TypeScript SUCCESS, build SUCCESS, deploy GitHub SUCCESS, Cloudflare Workers Build SUCCESS.
- Smoke po deployu: root i /login działają; /panel bez sesji zwraca login_required. Potwierdza aktualny frontend shell i ochronę routingu, nie zalogowane E2E.
- Zaktualizowano istniejący prompt automatyzacji 6afbeb034e4c81919dd6ad7d554497e0: osobne przepływy MAIN singiel 1 noga i AKO 3 różne mecze, recordStake=true, jedna stake/return, unique match guard oraz zakaz fałszywych agregatów SQL przez join fan-out. Harmonogram pozostaje codziennie 08:15 Europe/Brussels; następny run 18.11.


## 17.11.2026 08:45 Brussels — próbka results-sync v72
- Czwarty request v72: HTTP200, 3.249s. Reschedule skip80ms, parallel discovery207ms, ESPN53ms, TheSportsDB22ms, OpenMatchday67ms, alternate total353ms, main match load343ms, financial reconciliation 7 kuponów/128ms/0 błędów.
- FootyNomad pobrał 173 fixtures, 3 alternate observations dopasowano i zapisano; 0 wyników dopasowano/zapisano i 0 predykcji/nóg rozliczono. Brak błędów; brak rozliczeń oznacza brak nowego potwierdzonego wyniku, nie awarię synchronizacji.
- To dopiero czwarta próbka; porównać p50/p95 po pełnych 24h v72.


## 17.11.2026 09:00 Brussels — runtime audit and explanation of no-pick state
- Scope respected: production frontend only on Cloudflare Worker https://moneyball-global.damianwalus3.workers.dev/, repository damianwalus3-jpg/moneyball-global, branch main. No Vercel or TEST environment used.
- Current main before this UI patch: b500c1d7f11e11047695f1bf45114d12b5a25c17. CI run #1160 (44043379285) SUCCESS; Cloudflare deploy #746 (44043379235) SUCCESS.
- The Worker root returns HTTP 200. An unauthenticated fetch to /panel reaches the login gate; this is expected for the protected route and does not verify the authenticated UI. Recent production function logs show authenticated browser requests from Belgium to moneyball-predict returning HTTP 200.
- Application data backend remains the existing configured Supabase project gzgeklcukrclgwbsmbsp for database/auth/Edge Functions; it is not the frontend host. The frontend is served by Cloudflare Workers. No Supabase deployment, migration, secret change or Vercel action was performed in this audit.
- Brussels date 2026-11-17: database contains 110 rows dated today, including 99 FootyNomad rows; 2 rows pass the production eligibility function for European domestic senior men's tier 1/2. They are Warrenpoint Town — Glenavon FC and Rathfriland — Moyola Park (Northern Ireland Championship). The public FootyNomad page lists 173 fixtures overall, but includes cups, international fixtures, youth, reserve teams and lower divisions which are intentionally out of scope. UEFA calendar confirms Nations League matchdays 5–6 run 12–17 November; Premier League's published schedule says it returns 21 November.
- Production prediction scheduler state for 2026-11-17: completed at 07:00:19 UTC, 2 fixtures processed, no last_error; next scan 14:00 UTC (15:00 Brussels). The fixture feed cron remains active every 15 minutes; moneyball-free-feed v42 recent calls return HTTP 200 (about 1.5–2.3 seconds). Results sync v72 returns HTTP 200 on its five-minute schedule; no current-day results were available to settle.
- Current eligible matches have no selected picks. The model records them as ODRZUCONY because one has missing verified source data and the other probabilities are below the >75% threshold; there are no confirmed current bookmaker quotes. provider_odds has 219022 historical rows but 0 active quotes captured in the last 6 hours; newest captured_at is 2026-11-16 02:11:13 UTC. Do not generate MAIN/MEGA/EXTRA from stale quotes or force picks/coupons.
- Last-24-hour function-edge summary: moneyball-predict v244 has 1016 HTTP 200 requests, 8 HTTP 500 requests on the older v217/v218 at 20:32–20:39 UTC on 16 November, plus 2 HTTP 401; old errors were invalid scheduler token / permission denied for moneyball_cron_owner_id. Current v244 requests succeed. moneyball-results-sync v72 has 290 HTTP 200 requests (avg 7.38s, p95 13.52s, max 26.80s); moneyball-free-feed has recent HTTP 200 calls and no observed 5xx in the sample.
- UI correction: panel's no-picks message no longer tells the user to rerun a scan when a scan may already have completed; it explains the >75%, data-coverage and market-data gates. Coupon generator now displays the live number of eligible matches and explains why fewer than three prevent coupon generation. This is a usability clarification, not a relaxation of model or coupon safety rules.
- Verification of UI commit 9160382f54fa1208f17b326f9f550fdf6b8d03e0: GitHub CI run 44044115554 SUCCESS; Cloudflare Workers deploy run 44044115580 SUCCESS. Post-deploy root HTTP 200; unauthenticated /panel correctly reaches login_required. Do not mark the full project or issue #77 complete.


## 17.11.2026 09:12 Brussels — FootyNomad catalogue and cross-layer league-scope audit
- Retrieved all 55 European country pages linked by FootyNomad's public browse directory; all 55 returned successfully. Country pages expose their competition IDs and labels. The catalogue contains the expected domestic tier 1/2 labels for the countries where the provider currently lists those divisions.
- Found a real frontend/backend country-code mismatch: the ISO3 list in moneyball-free-feed and footynomad-sync contains ISR, and the production SQL scope helper accepts isr, but src/lib/domain.ts omitted isr from EUROPEAN_COUNTRIES. Consequently an OpenMatchday fixture with country='ISR' and a valid ISR_1/ISR_2 source folder could be rejected by the frontend even though the backend accepted it. The current production matches table has no Israel/ISR rows, so this is a preventive regression fix rather than an explanation for today's two fixtures.
- Positive alias comparison: free-feed and footynomad-sync ISO3 lists are identical; frontend missed only ISR. Their tier-name regexes are otherwise near-identical, with frontend missing provider/backend aliases 'e rovnuli liga' and 'prva liga republike srpske'; '2 bundesliga' is already covered by the generic bundesliga alias, 'p1 liga' is a Football-Data league code rather than a FootyNomad competition label, and 'liga nacional' is not part of the European national-league catalogue. Add the two legitimate label aliases and regression tests.
- Source coverage limitation: FootyNomad currently lists Luxembourg's National Division but not its second-tier Division of Honour; its Gibraltar directory currently lists Premier Division only; San Marino lists Campionato only; Liechtenstein lists a cup but no national league. Do not claim full 1-2 tier coverage in those cases without an alternate verified source. Keep these gaps visible in issue #77.
- No Supabase SQL, Edge Function, secret or deployment change in this patch. This fix is frontend-only and will be delivered through Cloudflare Workers MAIN. Vercel and TEST remain excluded.
- UI patch 9160382f was verified on Cloudflare MAIN. Current patch adds ISO3 Israel and provider alias regression cases; CI and Cloudflare deployment verification are pending.


## Kontynuacja produkcyjnego audytu i napraw — 2026-11-17 (08:xx UTC)

### Potwierdzone błędy i poprawki
1. **Błąd autoryzacji źródeł publicznych** — moneyball-predict wysyłał do moneyball-public-sources niespójne nagłówki apikey i Authorization, co powodowało HTTP 401 i brak dodatkowych danych. W supabase/functions/moneyball-predict/index.ts oba nagłówki są teraz jawnie ustawiane na ten sam klucz po stronie serwera. Edge Function moneyball-predict version 245 wdrożona. Test sieciowy przez pg_net z tymi samymi nagłówkami: HTTP 200, source_count=4, raw_fixtures=11, european_fixtures=8, formę obu drużyn ma 8/8 fixture. W odpowiedzi funkcji public_source_error=null.
2. **Nieefektywna paginacja ręcznego skanu** — dotychczasowy manual path pobierał LIMIT 10 surowych rekordów z matches, a dopiero później filtrował europejskie ligi top-two. W bazie 99 rekordów dnia tylko 2 były kwalifikowane, na pozycjach 80 i 94, co powodowało puste pierwsze strony i niepotrzebne wywołania. Dodano migrację 20261117090000_add_authenticated_manual_prediction_scan_page.sql, funkcję moneyball_manual_prediction_scan_page(date, integer, integer) z auth.uid() i filtrowaniem/deduplikacją przed paginacją. Migracja zastosowana w produkcyjnym projekcie Supabase gzgeklcukrclgwbsmbsp. Test SQL z kontekstem właściciela zwrócił 2 kwalifikowane mecze, count=2, has_more=false. Funkcja nie przyjmuje owner_id od klienta; zakres ogranicza auth.uid().
3. Manual path w moneyball-predict version 246 korzysta teraz z nowego RPC; cron nadal używa istniejącego cursor/lease RPC. Wdrożenie Supabase Edge Function version 246 aktywne.

### Testy i wdrożenie
- Commit auth fix: bb9bf0d4d569319f262501c71df925558ce35a75.
- Commit manual pagination: bf4a797f91649ee34f51aa6cf274add939969b66.
- Migracja SQL zastosowana; test owner-scope: 2/2 kwalifikowane, brak kolejnej strony.
- CI run #1166 / ID 44045844923: SUCCESS (Deno check, testy, TypeScript, build).
- Cloudflare deploy run #752 / ID 44045845062: SUCCESS.
- Produkcyjny Cloudflare Worker root i /login odpowiadają poprawnie; prywatny /panel wymaga logowania. Zewnętrzny browser test nie posiada sesji użytkownika, więc nie deklarować pełnego testu zalogowanego UI.
- Ponowny produkcyjny skan uruchomiony po poprawce (Edge Function version 246): HTTP 200; matches=2, predictions=24, updated=24, covered=2, missing=0, selected=0, couponCreated=false; import: feed 2, public source 8, eligible 2, inserted 0, skipped existing 2; public_source_error=null; skan zakończony, następny termin 2026-11-17 15:00 Europe/Brussels.
- Nie zmieniano historycznych rekordów, kuponów ani salda. Nie wykonywano prawdziwych zakładów.

### Aktualny stan i blokery
- FootyNomad podał 173 fixtures na 2026-11-17; baza zawiera 99 rekordów dla dnia, ale tylko 2 spełniają aktualny zakres: europejskie krajowe ligi mężczyzn, poziomy 1–2. Pozostałe wpisy obejmują m.in. rozgrywki UEFA, młodzież, puchary, rezerwy i niższe ligi. Nie rozszerzać zakresu przez dopuszczanie niekwalifikowanych spotkań. Issue #77 pozostaje OTWARTE do pełnego porównania katalogu lig i UI.
- W provider_odds: 219022 historycznych rekordów MoviOdds/bet365, ale 0 aktywnych kursów z ostatnich 6 godzin; najnowszy zapis 2026-11-16 02:11:13 UTC. MoviOdds wymaga klucza API, którego użytkownik nie chce. Bwin Sports API wymaga oficjalnego partnerstwa i indywidualnych kluczy. Nie używać kursów starych, syntetycznych ani niepotwierdzonych; MAIN/MEGA/EXTRA pozostają zablokowane bez świeżego źródła.
- Publiczny katalog odss-api udostępnia bez klucza wyłącznie coverage; rzeczywiste kursy wymagają klucza, a endpoint mock zwraca ceny syntetyczne — nie używać go do prognoz/kuponów. Football-Data.co.uk publikuje pliki historyczne/okresowo aktualizowane, nie jest to feed live; warunki źródła ograniczają automatyczne użycie AI/botów, więc nie wdrażać scraperów bez zgody.
- Nie wdrażać Vercel, TEST, płatnych API ani nowych sekretów. Nie zamykać #77 ani nie ogłaszać całego projektu jako ukończonego.

## Production repair checkpoint — 2026-11-17 08:15–08:30 UTC

### Source authorization and prediction scan
- Root cause of the two public-source HTTP 401s at 07:00:05 UTC was Supabase rejecting conflicting API keys: apikey used the publishable key while Authorization carried a secret key. The final fix in commit bb9bf0d4d569319f262501c71df925558ce35a75 explicitly sends matching keys in both headers from the server-side moneyball-predict function. Supabase Edge Function version 245 deployed.
- Direct pg_net request with the exact matching headers returned HTTP 200, source_count=4, raw_fixtures=11, european_fixtures=8, and form coverage for 8/8 fixtures. After the fix, scheduled_import logged public_source_error=null.
- Manual prediction scan previously paginated raw matches before eligibility filtering. The two eligible fixtures were at raw row positions 80 and 94 of 99, so the first 8 pages were empty and the client had to traverse out-of-scope rows.
- Added owner-scoped RPC moneyball_manual_prediction_scan_page(date, integer, integer) in migration 20261117090000_add_authenticated_manual_prediction_scan_page.sql (commit 9d9c621ed2f59679877becb2ab17e232f6fa2cb9). Manual branch in moneyball-predict now uses this RPC (commit bf4a797f91649ee34f51aa6cf274add939969b66); Supabase Edge Function version 246 deployed.
- RPC test with the actual owner context returned 2 rows, count=2, has_more=false. Cross-owner test returned 0 rows. RPC does not accept owner_id from the client and derives it from auth.uid().
- Re-run of today's scheduled scan on version 246 completed successfully: matches=2, predictions=24, updated=24, covered=2, missing=0, selected=0, couponCreated=false. Import metrics: feed_rows=2, public_rows=8, eligible_rows=2, inserted=0, skipped_existing=2, feed_error=null, public_source_error=null. Next scheduled scan remains 15:00 Europe/Brussels.

### Scope predicate and regression fixes
- Shared eligibility helper did not reject named reserve teams such as Real Madrid Castilla, Celta Fortuna, Valencia Mestalla, Betis Deportivo and Sevilla Atletico. Added these exclusions to moneyball_is_eligible_european_match in migration 20261117093000_exclude_named_reserve_sides_from_shared_eligibility.sql (commit 264726ce3ef40c04b3f2b03a8cb4ae74f5c30539).
- SQL alias audit found a prefix-match bug: NB III could match the NB I/NB II aliases in moneyball_is_european_top_two_league. Added a negative rule for roman numeral tier III+ aliases in migration 20261117094000_exclude_hungarian_third_tier_nb_iii.sql (commits d42089df130bbab04f84af35fe3ff6783fe58383 and cdd5be949dbe8ac4b2ba943f5c96f097a12e2722).
- Regression checks: NB I and NB II remain allowed; NB III, NB IV and Romania Liga III are rejected. Named Spanish reserve teams are rejected by the shared helper. The 100+ tested expected European tier-one/tier-two labels remained accepted; issue #77 remains open pending the complete source-catalogue comparison.
- Frontend regression tests for NB I/II vs NB III/IV and named reserve teams added in commit e82719edd24d9fcdf8cc7953ad83e76dd8380632.

### Coupon finance and bankroll audit
- Finance summary previously counted a zero-stake test coupon with unknown odds as an incomplete financial settlement. Migration 20261117100000_ignore_zero_stake_coupons_in_finance_summary.sql (commit 5658bacaeb8079df9e691635aee523286010f39b) now treats stake=0 as payout=0 for financial aggregation.
- Finance summary now has one incomplete historical coupon, not two: a 5 EUR test coupon marked won but with no recorded odds/potential return. Do not invent or backfill a payout without verified historical odds.
- Ledger audit: opening deposit 91.60 EUR, total stakes 23.00 EUR, recorded returns 15.68 EUR, current ledger balance 84.28 EUR; no duplicate coupon transactions and no balance_after mismatches. The incomplete historical 5 EUR coupon has no recorded return, so final historical net remains incomplete. New coupons retain the 4 EUR rule; historical 5 EUR stakes are not rewritten.

### Production verification and remaining blockers
- GitHub CI run 44046719711 and Cloudflare deploy run 44046719759 for commit e82719ed: SUCCESS.
- Public Worker root and /login load. /panel correctly returns login_required to an unauthenticated browser; no authenticated user session was available, so logged-in UI/E2E is still unverified.
- Production logs 00:00–09:00 UTC: moneyball-predict v246 7 requests, all HTTP 200 (avg 2.76s, p95 7.06s, max 9.17s); moneyball-results-sync v72 13 requests, all HTTP 200 (avg 5.05s, p95 7.87s, max 8.83s); moneyball-free-feed v42 14 requests, all HTTP 200; moneyball-public-sources v62 10 requests, all HTTP 200; MoviOdds v7 5 requests, all HTTP 200/skipped because no key. The two 401s occurred before the auth fix at 07:00:05 UTC; no v246 public-source 401 or 5xx was observed in the post-fix scan.
- Today's Brussels scope: FootyNomad reports 173 total fixtures; DB contains 99 rows for today, only 2 meet the actual Europe domestic senior men's tier 1/2 rule. The other source entries include international competitions, cups, youth, reserves and lower tiers. Do not treat 173 as 173 eligible fixtures.
- Fresh odds remain unavailable: 0 active provider_odds records in the last 6 hours; latest stored MoviOdds capture 2026-11-16 02:11:13 UTC. MoviOdds requires an API key and Bwin partner API access is restricted. Do not use stale, synthetic or non-Belgian prices as current bookmaker odds. MAIN/MEGA/EXTRA remain blocked until a verified current odds source is available.
- Do not close issue #77, claim full league coverage, or declare the complete project finished. No Vercel/TEST deployment, no historical data deletion, no real-money betting.

## Statistics performance and financial-field repair — 2026-11-17 08:32–08:38 UTC

- Statistics page previously fetched all 2,596 historical match rows, all coupons/legs, then active-model predictions in multiple per-match-ID chunks. The page needed only eligible European senior tier 1/2 matches and active-model predictions.
- Added owner-scoped SECURITY DEFINER RPC moneyball_statistics_page_data() in migration 20261117103000_add_owner_scoped_statistics_page_rpc.sql; then compacted its JSON payload in 20261117104500_compact_statistics_page_payload.sql and included the rationale required by the detail drawer in 20261117110000_include_rationale_in_statistics_payload.sql.
- The RPC returns only eligible matches, active MONEYBALL GLOBAL 3.8/MANUAL predictions, coupons whose every leg belongs to an eligible match, and those legs. It also joins verified match_results for home_score/away_score. It includes stored prediction stake, potential_return, profit_loss and rationale, but omits bulky note/data_coverage metadata.
- Owner-context SQL test: 374 eligible matches, 1,321 active predictions, 1 scoped coupon, 3 legs; JSON payload 798,520 bytes. The initial compact payload without rationale was 598,586 bytes. Earlier broad payload was 5,185,440 bytes. Final payload is about 84.6% smaller than the broad version and returned in about 1.7 seconds in the SQL test.
- Security tests: anon/public do not have EXECUTE; authenticated does. A different owner UUID receives 0 matches, 0 predictions, 0 coupons and 0 legs.
- Frontend db.ts now uses the single RPC. Statistics types are narrowed to the exact fields used by the page. schema.ts adds predictions.stake/potential_return/profit_loss and coupon_legs.match_id to canonical read columns; coupon-leg adapter preserves the database match_id. Stats page now receives verified scores and actual stored stake/P&L rather than defaulting to 4 EUR when historical stake differs.
- Regression tests added in src/lib/schema.test.ts. The pre-existing schema contract test was updated because coupon_legs.match_id became canonical in migration 20261117072931. Type-check initially caught that the stats detail drawer also renders prediction.rationale; the RPC and StatisticsPrediction type were corrected to include it.
- Final code commit 99b90fa73580bff38750fa46358d896680abe705: CI run 44048281991 SUCCESS; Cloudflare deploy run 44048281920 SUCCESS. Earlier intermediate CI failures were corrected; do not treat them as current failures.
- Production root and /login smoke test succeeded after deployment; /panel remains login-protected. No authenticated UI session was available, so the statistics page itself has not been clicked through in a logged-in browser.
- Remaining full-history operations: bankroll page reads its small ledger/coupon tables; saveCouponBatch, cancelCoupon and client settlement reconciliation still read the full bankroll ledger. Current ledger has 9 transactions and 9 coupons. Do not refactor financial settlement/cancellation without a rollback-only regression test; the existing server-side moneyball_reconcile_coupon_finance RPC is service_role-only and must not be called directly from the browser.

### Current unresolved blockers remain
- The 15:00 Europe/Brussels scan still needs its post-run audit.
- Issue #77 remains open pending a complete country-by-country FootyNomad catalogue comparison and authenticated MAIN UI verification.
- Fresh odds are still unavailable without an approved no-key source or user approval for a free provider key. MAIN/MEGA/EXTRA remain blocked; no stale or synthetic prices.
- One historical 5 EUR TEST coupon marked won still has no recorded odds/payout; keep it financially incomplete rather than inventing a return.
- Project is not complete. Do not deploy Vercel or TEST.

## Atomic coupon finance, exact odds and source research — 2026-11-17 08:45–08:52 UTC

### Owner-scoped financial operations deployed
- Migration 20261117084010_owner_scoped_coupon_finance_rpcs created:
  - `moneyball_reconcile_coupon_finance_for_owner(p_coupon_id)`: authenticated owner check, then invokes the existing service-role-only reconciliation function.
  - `moneyball_cancel_coupon_for_owner(p_coupon_id)`: atomic owner-scoped cancellation, voids legs, refunds an existing stake once, and rebuilds ledger balances in one transaction.
- Frontend `settlement.ts` no longer fetches the full bankroll ledger and recalculates every row after settlement. It calls the owner-scoped reconciliation RPC after leg updates.
- Frontend `coupons.ts::cancelCoupon` now calls the atomic cancellation RPC instead of downloading all coupons, legs and transactions and updating balances client-side.
- Security: authenticated can execute both wrappers; anon cannot. Cross-owner calls to both wrappers were tested and denied.
- Rollback-only SQL test passed: pending 3-leg coupon → won; repeated reconcile creates exactly one stake and one return; cancellation refunds exactly once; ledger balance is rebuilt. Test coupons/transactions were rolled back and confirmed absent afterward.

### Exact odds and payout calculation
- Migration 20261117084525_align_coupon_odds_precision_and_payout aligns the reconciliation function with the finance summary: combined odds stored/displayed to 3 decimals; payout is calculated from the unrounded product of individual leg odds and rounded only to cents.
- Migration 20261117084559_handle_void_legs_in_coupon_price_trigger makes the coupon-price trigger treat void legs as odds 1.00 and use the same exact payout rule.
- Frontend `totalOdds` and `effectiveOdds` now use 3-decimal combined odds. `couponPayout` calculates stake × exact active-leg odds, then rounds the cash return to cents.
- Regression case: 1.100 × 1.182 × 1.167 = 1.517 displayed odds; 4 EUR stake pays 6.07 EUR, not 6.08 EUR. Both SQL rollback-only tests and the new domain unit test cover this.
- Price-trigger rollback test passed: inserting the three legs immediately stores combined_odds=1.517 and potential_return=6.07.
- This fixes the former one-cent mismatch between the client calculation and the database finance summary.

### Current bankroll / finance snapshot after all rollback tests
- 9 bankroll transactions, 9 coupons, latest balance_after = 84.28 EUR. All rollback-only tests left production balances and records unchanged.
- Finance summary: all history count=7, stake=23 EUR, payout=15.68 EUR, incomplete=1, net=NULL. Two zero-stake legacy test coupons are excluded from financial totals.
- Week: count=3, stake=13 EUR, payout=15.68 EUR, net=+2.68 EUR.
- MAIN: 1 coupon, stake=5 EUR, payout=5.25 EUR, net=+0.25 EUR.
- TEST: 6 coupons, stake=18 EUR, payout=10.43 EUR, incomplete=1; net remains NULL because historical coupon `MONEYBALL AUTO TEST 2026-11-12` is marked won but has no odds/payout. Do not invent a payout or rewrite historical stake.

### Public odds-source research — no compliant replacement found
- Tested TipsAudit's public `GET /api/v1/predictions` from production Supabase via `net.http_get`; HTTP 200, generated_at 2026-11-17 08:48:39 UTC, 292 upcoming matches, 284 fresh fair-price records, 3 soft-value quotes.
- Today's 9 entries were one Ukraine Persha Liga reserve-side fixture and eight UEFA Nations League matches; none matched our domestic European senior tier 1/2 scope. The only today's soft quote was 1xBet (not a Belgian bookmaker) and only a 0.64% monitor signal. The API provides mainly 1X2 fair odds, not a complete current Belgian bookmaker board for 1X2/DC/GOALS.
- Official TipsAudit terms say free without API key, 60 requests/minute, ~5-minute prediction refresh, but require visible attribution. It is potentially a secondary 1X2 fair-market benchmark only, not a bookmaker price source and not sufficient for coupons.
- A Flashscore-derived Apify actor advertises no key/login but charges from $0.79 per 1,000 matches; it is paid and scrapes Flashscore, so do not use under the user's no-paid-source constraint without explicit approval.
- football-data.co.uk is historical, not a live bookmaker feed, and its terms are not suitable for automated app scraping. Bwin partner API still returned 403/partner access required; MoviOdds returned 401 without a key.
- Therefore there is still no verified free, no-key, permitted source covering the required Belgian bookmaker prices and markets. MAIN/MEGA/EXTRA must remain blocked when prices are not fresh; never substitute fair odds, old detected prices or synthetic prices for current bookmaker odds.

### Deployment / remaining verification
- Latest commit: ee8e6eb1 (odds precision and void-leg trigger). GitHub CI run 44049531490 SUCCESS; Cloudflare production deploy run 44049531394 SUCCESS.
- Production Worker root and login were reachable after the earlier frontend deployment; /panel remains login-protected. No authenticated browser session was available, so do not claim logged-in end-to-end UI verification.
- Latest current balance remains 84.28 EUR. The project is not complete.

### Remaining blockers
1. Verify the 15:00 Europe/Brussels scan and its source/error/prediction counts.
2. Keep issue #77 open until the full country-by-country FootyNomad tier 1/2 catalogue and authenticated MAIN UI have been verified.
3. Find a compliant fresh odds source or obtain explicit approval for a free key/paid feed. Until then no MAIN/MEGA/EXTRA coupon from stale prices.
4. Complete authenticated end-to-end scan → coupon → result → bankroll → statistics test in the user's existing session.
5. Remaining small full-table reads are limited to Bankroll display and saveCouponBatch balance lookup; settlement and cancellation no longer read the full ledger.

## European league catalogue and eligibility regression audit — 2026-11-17 10:01 Europe/Brussels

### Source catalogue evidence (not a completion claim)
- UEFA's official association directory lists 55 member associations: https://www.uefa.com/nationalassociations/
- OpenMatchday 2026/27 LEAGUE_INDEX contains 48 tier-1/tier-2 rows globally, of which 38 are European domestic rows across 29 UEFA member countries (28 tier-1 rows and 10 tier-2 rows; Ireland appears as tier 2 only). It is free/no API key and updated daily, but its README limits the compilation to informational non-commercial use with attribution; it is not live and has no xG, lineups, injuries or odds: https://github.com/oladeeayo/open-matchday
- FootyNomad's current /browse snapshot exposed 13 European country sections and 26 tier-1/tier-2 competition labels. All 13 are within OpenMatchday's 29-country set. The same-day /fixtures/2026-11-17 page reports 173 matches across 20 countries and includes two Northern Ireland Championship fixtures, although Northern Ireland is absent from the visible /browse country list. Treat this as a directory inconsistency; do not treat /browse as a complete authoritative country catalogue.
- ESPN's current domestic league code list covers 16 countries, all already represented in OpenMatchday's 29-country set; it adds no new country coverage. OpenLigaDB adds Germany only. TheSportsDB did not add a new domestic tier-1/tier-2 country in the tested day sample.
- Current combined source evidence: at least one national domestic tier-1 or tier-2 source is visible for 30/55 UEFA associations; tier 1 for 28, tier 2 for 19, and both tiers for 17. This is catalogue evidence, not proof of full fixture availability or complete coverage of both tiers in all 30 countries.
- 25 UEFA associations have no verified tier-1/tier-2 national domestic fixture source in the current source catalogues: Albania, Andorra, Armenia, Azerbaijan, Belarus, Bosnia and Herzegovina, Bulgaria, Estonia, Faroe Islands, Georgia, Gibraltar, Hungary, Iceland, Israel, Kosovo, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Moldova, Montenegro, North Macedonia, San Marino and Serbia.
- OpenFootball Europe has current 2026/27 text files for Czechia, France, Greece, Netherlands, Portugal, Scotland, Switzerland and Turkey; these countries are already represented by OpenMatchday, so this snapshot adds no new country coverage. The football.json mirror's latest commit was 2026-09-22 and is too stale to trust as a current-day source without a freshness check: https://github.com/openfootball/europe and https://github.com/openfootball/football.json
- On 2026-11-17, moneyball-public-sources returned 11 raw fixtures, 8 classified as European and 8 unique. The 8 European fixtures were UEFA Nations League/international fixtures, not domestic leagues. OpenMatchday checked 38 European competitions and returned 0 fixtures; ESPN returned 8 international fixtures; OpenLigaDB returned 0; TheSportsDB returned 3 non-qualifying events. The public-source aggregator's european_fixtures field is not the same as domestic tier-1/tier-2 eligibility.
- Production DB day snapshot: 110 rows across sources, 2 pass the shared domestic senior-men tier-1/tier-2 predicate, 1,321 active model predictions. The 99 FootyNomad rows include 2 eligible Northern Ireland Championship matches and 97 out-of-scope rows retained for history/audit; do not delete them.
- The 13 FootyNomad browse countries and 26 league labels were tested against production SQL. Before this repair, three false positives passed: Italy 'Serie D - Championship Round' (4th tier matched generic 'championship'), Sweden 'Damallsvenskan' (women's league matched the 'allsvenskan' substring and the name was not recognized by the importer gender detector), and England 'Premier League - Summer Series' (special exhibition matched generic 'premier league').

### Scope-filter repair and regression results
- Code commit b02709f63e4b141ada5fb025b8b30a1b3f1ed9e9 updated src/lib/domain.ts, src/lib/domain.test.ts, supabase/functions/footynomad-sync/index.ts, supabase/functions/moneyball-free-feed/index.ts and supabase/functions/moneyball-public-sources/index.ts. It explicitly rejects Serie D, Damallsvenskan, WSL/Liga F and Summer Series, and recognizes those women's league labels in importer gender detection.
- Migration file supabase/migrations/20261117124000_exclude_serie_d_womens_and_summer_series.sql (migration applied successfully; migration-file correction commit f15a2a985e30b6e2c85f0ae60562a73ebe2b7971) updates production moneyball_is_european_top_two_league and moneyball_is_eligible_european_match with the same exclusions.
- SQL regression test: 12/12 cases passed. Valid controls retained: Italy Serie A/B, England Premier League/Championship, Sweden Allsvenskan/Superettan, Belgium Jupiler/Challenger Pro. All three false positives now return false from both production predicates, including Damallsvenskan when gender is NULL.
- Re-evaluating all 634 FootyNomad browse labels now leaves exactly the expected 26 accepted tier-1/tier-2 labels across the 13 country sections; the three false positives are no longer accepted.
- Production Supabase Edge Functions deployed with JWT settings preserved: moneyball-public-sources v63 (verify_jwt=false), footynomad-sync v87 (true), moneyball-free-feed v43 (true). Post-deploy public-source v63 logs: 3 HTTP 200 calls in 2.375s, 3.873s and 3.965s; no error. footynomad-sync v87 and moneyball-free-feed v43 have not yet been exercised by a post-deploy scheduled import; verify at the next 15:00 Europe/Brussels scan.
- GitHub CI run 44051320905 SUCCESS and Cloudflare Worker deploy run 44051320954 SUCCESS for commit f15a2a985e30b6e2c85f0ae60562a73ebe2b7971. Earlier intermediate deploy runs were cancelled because a newer commit superseded them; final run is SUCCESS.
- Production Worker root and /login load. /panel correctly returns login_required without a user session; authenticated UI verification remains outstanding.
- Finance rollback-only integration test passed after the new owner-scoped RPC changes: 3-leg coupon at EUR 4, odds 1.50×1.60×1.55 = 3.72, potential return/payout EUR 14.88, one stake and one return only, repeat reconciliation idempotent, cancellation refunds EUR 4 and rebuilds the same ledger balance. Transaction rolled back: 0 test coupons and 0 test transactions remain. Real ledger remains EUR 84.28 with 9 transactions and 9 coupons.

### Remaining blockers and next steps
1. Keep issue #77 OPEN. Build a source-by-source, country-by-country catalogue for the 25 missing associations and add only verified, current, legally usable no-key feeds. Do not invent fixtures or infer a league from country membership.
2. Verify the 15:00 Europe/Brussels scan after Edge Function versions 87/43/63: importer errors, source counts, eligible matches, predictions, deduplication and result sync.
3. Complete authenticated MAIN UI E2E in an existing user session. No password or fabricated identity.
4. Fresh Belgian bookmaker odds remain unavailable from current no-key sources. Do not create MAIN/MEGA/EXTRA from stale/fair/synthetic odds; no real-money betting.
5. Project is not complete. Do not close issue #77, deploy Vercel/TEST, delete historical rows or rewrite historical finance.

## Football Charts provider evaluation and restricted fallback — 2026-11-17 10:20 Europe/Brussels

### Provider facts verified
- Official docs: https://www.football-charts.com/developers ; API base https://footballcharts-backend.onrender.com/api/v1.
- API catalogue: 98 leagues in 44 countries; 31 UEFA associations in the European subset.
- Free no-key tier: 25 requests/day per IP, 20/min. Free key: 200/day after email confirmation, but MONEYBALL does not use a key.
- API updates once daily after overnight run, about 06:00 UTC; fixture endpoint returns upcoming fixtures for the next few days, with no date parameter.
- Free plan is for personal/private projects with attribution. If other people use the app/site/bot, Commercial plan is required. Raw API responses/data may not be redistributed. Terms: https://www.football-charts.com/terms
- No free-tier odds or per-match xG/shots/pass stats. Provider model predictions are deliberately discarded.

### Coverage gain
- Seven previously uncovered UEFA associations gain a tier-1/2 catalogue source: Azerbaijan, Bulgaria, Estonia, Hungary, Latvia, Lithuania and Serbia.
- Combined catalogue evidence rises from 30/55 to at least 37/55. The 18 remaining associations without a verified current tier-1/2 national domestic source: Albania, Andorra, Armenia, Belarus, Bosnia and Herzegovina, Faroe Islands, Georgia, Gibraltar, Iceland, Israel, Kosovo, Liechtenstein, Luxembourg, Malta, Moldova, Montenegro, North Macedonia and San Marino.
- Only eight league IDs are allowlisted: azer, bulgaria1, estonia, hungary1, hungary2, latvia, lithuania, serbia1. Women's, youth, third-tier, regional and exhibition competitions are excluded.
- All eight fixture endpoints returned valid JSON. The 17 Nov sample had no same-day fixture among these eight; upcoming fixtures were present for 20–23 Nov in Bulgaria/Azerbaijan/Hungary/Serbia, Hungary II on 21–22 Nov, next-known dates 21 Nov Lithuania and 22 Nov Estonia; Latvia had no fixture in the next three days. This is endpoint validation, not a completed database import.
- TheSportsDB check: all-leagues returned only 10 rows; 21 Nov events-day returned 3 events (two Brazil, one Sweden), adding no missing UEFA country.
- OpenFootball Europe index: 207 files, mostly 2024–25 or 2025 calendar seasons. Only France, Netherlands and Portugal show 2026–27 entries. CC0/public domain, useful for historical research but not a current feed for the remaining gap.
- FotMob and SofaScore were not adopted despite technically reachable endpoints. FotMob's terms prohibit automated retrieval without permission; SofaScore terms prohibit database extraction/re-use without express consent. References: https://github.com/probberechts/soccerdata/issues/918 and https://www.sofascore.com/terms-and-conditions (2.8–2.9). Do not repeat scraping probes or integrate without written permission.

### Implementation in MAIN
- Commit 2d1ae325a7d8ad4bbaf4d2697434c5e6a2b62acb adds the Football Charts fallback to authenticated footynomad-sync, provider aliases and regression tests. It calls only eight allowlisted league endpoints, filters to the exact Europe/Brussels date, parses documented UTC timestamps, stores minimal fixture fields and source URL/attribution, and discards the provider model and stats.
- Commit f382cab9cb8228ef64ad154a602966e9037edf42 adds an owner-only gate for personal-use licensing. The feed is fetched only for owner UUID 668d578c-40dd-4767-8b9d-6b17c7eeebb5; other signed-in accounts skip it. It is not exposed through public moneyball-public-sources.
- Cache: 12 hours after full success, 30 minutes after partial failure. Eight requests per scan; two scans could use up to 16 of 25 keyless daily requests if isolate cache is cold. Repeated manual scans can exhaust the limit; failures do not block FootyNomad.
- Migration 20261117102000_add_footballcharts_bulgaria_lithuania_aliases.sql applied. SQL now accepts Bulgaria efbet League and Lithuania TOPLYGA.
- SQL regression 15/15 passed. Frontend tests, Edge Function type-check and build passed.
- GitHub CI 44053372684 SUCCESS; Cloudflare MAIN deploy 44053372690 SUCCESS for f382cab9. Supabase footynomad-sync v88 deployed with verify_jwt=true; deployed source inspection confirms allowlist, owner gate, attribution and model exclusion.
- Worker root and /login load; /panel returns login_required without a user session. Authenticated post-deploy scan is still pending, so DB import is not yet proven end-to-end.

### Next actions
1. Verify footynomad-sync v88 on the next authenticated MAIN scan (15:00 Europe/Brussels): provider status, requests, eligible fixture count, inserts, deduplication and predictions. Do not fabricate a user session or request credentials.
2. Monitor the 25/IP daily keyless request budget; keep to eight allowlisted leagues. No key is stored or required.
3. Find lawful current feeds for the 18 remaining associations. Do not treat old OpenFootball files as current fixtures or scrape FotMob/SofaScore.
4. Fresh Belgian bookmaker odds remain unavailable; MAIN/MEGA/EXTRA stay blocked when verified odds are absent.
5. Issue #77 stays OPEN; project is not complete.
## FootyNomad day-page vs DB reconciliation — 2026-11-17 10:24 Europe/Brussels

- Full FootyNomad page for 17 Nov reports 173 matches across 20 countries: https://footynomad.com/fixtures/2026-11-17
- Owner DB contains 99 FootyNomad rows for the Brussels-local day. Grouped DB counts: 41 European domestic-category rows, 57 UEFA/World competition rows (senior Nations League and U17/U19/U21/U20 competitions), plus one Ukraine Persha Liga row involving Polissya II.
- The page's European domestic categories are exactly France National 2 (1), Czech 3. liga (1), England domestic lower tiers/cups (28), Northern Ireland Championship (2), Portugal U23 (1), Scotland Lowland League (8) = 41; all 41 are present in the DB. No European domestic day-page fixture omission was found in this comparison.
- Exactly 2/41 European domestic rows qualify: Northern Ireland Championship matches Rathfriland–Moyola Park and Warrenpoint–Glenavon. The remaining 39 are correctly out of scope: France National 2 (tier 4), Czech 3. liga (tier 3), England EFL Trophy/cups and National League North/South + Non-League Premier (lower tiers), Portugal Liga Revelação U23, Scotland Lowland League (below tier 2).
- Ukraine Persha Liga is not a reserve-tier alias issue: one side is Polissya II, so the B-team exclusion correctly rejects it.
- The 173 page total is global, not Europe-only: it includes AFC U17, AFCON qualifiers, friendlies and non-European domestic fixtures. Do not compare 173 directly with the 99 Europe-filtered stored rows or treat the difference as an importer failure.
- This reconciliation confirms the day-specific European filter and importer coverage for the visible European domestic categories. It does not prove every country has a source on every date; the separate 18-country source gap remains.
## OpenLigaDB / FixtureDownload checks and remaining provider deploy — 2026-11-17 10:27 Europe/Brussels

- OpenLigaDB directory returned 849 historical/current-season rows. Filtering 2025+ showed the current 2026 season is concentrated in Germany plus selected already-covered countries (Austria, England, Netherlands, Spain) and international tournaments. It adds no new association among the remaining 18. The Spanish LaLiga 2026 endpoint returned 380 records with valid matchDateTime; Eredivisie returned 306 but matchDateTime was null and matchDateTimeUTC was the invalid 1970-01-01 sentinel; Austria shortcuts tested returned zero. Do not import the broken ERE time values.
- FixtureDownload's current football catalogue exposes UEFA tournaments and some major domestic leagues, but no verified domestic tier-1/tier-2 feed for the remaining 18 associations. No new integration added.
- Important deployment follow-through: moneyball-free-feed was updated in code with efbet League and TOPLYGA aliases but was still deployed at v43. It is now deployed as v44, verify_jwt=true, preserving JWT protection. footynomad-sync remains v88, verify_jwt=true. This closes the code-vs-edge version mismatch for the new aliases.
- No authenticated user scan was run from this audit; the next 15:00 MAIN scan remains the end-to-end check.
## Correction: FootyNomad upcoming day pages expand verified coverage — 2026-11-17 10:35 Europe/Brussels

The previous 18-country gap was overstated because it relied too heavily on the FootyNomad /browse directory, which lists only 13 countries and is not a complete catalogue. Current day fixture pages expose more country/league sections.

### Day-page observations
- 20 Nov 2026: 342 fixtures / 72 countries. Additional senior domestic top-two labels included Bulgaria First/Second League, Cyprus 2. Division, Armenia Premier League, Azerbaijan Premyer Liqa/Birinci Dasta, Georgia Erovnuli Liga, Gibraltar Premier Division, Kosovo Superliga, Macedonia First League and Malta Premier League.
- 21 Nov 2026: 1,269 fixtures / 103 countries. Additional labels included Andorra 1a Divisió, Armenia First League/Premier League, Belarus Premier League/1. Division, Bosnia Premijer Liga and 1st League FBiH/RS, Georgia Erovnuli Liga 2, Gibraltar Premier Division, Kosovo Superliga, Macedonia First/Second League, Montenegro First/Second League and San Marino Campionato.
- 22 Nov 2026: 908 fixtures / 95 countries. New senior domestic top-two labels include Albania Superliga/1st Division and Luxembourg National Division; the page also confirms Andorra, Armenia, Azerbaijan, Bosnia, Gibraltar, Kosovo, Macedonia, Malta and San Marino.
- 23 Nov 2026: 113 fixtures / 42 countries; no new previously-unobserved UEFA domestic league source was identified in the page's section headings.
- This adds 13 previously unobserved UEFA associations to the prior 37/55 catalogue evidence: Andorra, Armenia, Belarus, Bosnia and Herzegovina, Georgia, Gibraltar, Kosovo, Malta, Montenegro, North Macedonia, San Marino, Albania and Luxembourg. Current observed source coverage is therefore at least 50/55, not 37/55.
- Five associations remain unverified in this sample: Faroe Islands, Iceland, Israel, Liechtenstein and Moldova. Liechtenstein has no independent national league; its clubs play in the Swiss league system. Faroe Islands and Iceland use calendar-year seasons and may be between seasons in November. Israel has no fixture section in the 20–23 Nov sample. Moldova appears as a country heading with a match count but no competition heading or fixture-card details; do not infer a competition.

### Filter and parser validation
- Production SQL regression across 43 labels from the 20–21 Nov FootyNomad day pages passed 43/43. Controls include Andorra, Armenia, Azerbaijan, Belarus, Bosnia, Bulgaria, Cyprus, Georgia, Gibraltar, Kosovo, Macedonia, Malta, Moldova named leagues, Montenegro, San Marino, Northern Ireland, Romania and Croatia; lower-tier controls (Bulgaria Third League, Georgia Liga 3, Poland II Liga, England National League/League One, France Ligue 3, Italy Serie C, Spain Primera RFEF, Portugal Liga 3, Belgium First Amateur, Scotland Highland League, Switzerland 1. Liga Promotion) all reject.
- Additional 22 Nov SQL regression passed 12/12 for Albania, Luxembourg, Faroe Islands, Iceland, Israel, named Moldova leagues and empty Moldova competition. Empty competition correctly rejects; do not infer a league from country alone.
- The importer parser previously found the nearest league-group before checking the country heading. If a country section had no league heading, this could inherit a league from the previous country. Commit 243de2f00c8c86875c6a7335996e3a9abd41ce12 reverses the order and requires the league group to be after the current country heading (gs > cs). A regression test confirms blank competition remains rejected.
- Supabase footynomad-sync v89 deployed with verify_jwt=true. GitHub CI 44055361844 SUCCESS. Cloudflare MAIN deploy run 44055361947 was initiated for commit 243de2f; verify final status. The parser correction is not yet proven by a live authenticated import; verify at the next 15:00 scan.

### Current coverage statement
- At least 50/55 UEFA associations have a verified current tier-1/tier-2 fixture source in the combined catalogue/day-page evidence. This is source/season evidence, not a guarantee that every country has fixtures every day.
- The remaining five are not all true gaps: Liechtenstein has no domestic league; Faroe Islands and Iceland are out of season in November; Israel and Moldova need further official source/fixture verification.
- The FootyNomad /browse page is not an authoritative complete league directory. Use actual dated /fixtures/YYYY-MM-DD pages for source discovery and compare their competition sections against importer output. Do not count every global match as an eligible European match.
- The 17 Nov reconciliation remains unchanged: 41 European domestic-category rows in the page/DB; only two Northern Ireland Championship fixtures meet tier-1/2 senior-men scope.
## Shared FootyNomad parser + UI scope regression — 2026-11-17

### Second parser path corrected
- Discovery: the 15-minute automatic `moneyball-free-feed` had a separate FootyNomad HTML parser from authenticated `footynomad-sync`. The earlier country-heading/league-group fix had only been applied to the authenticated importer, leaving the automatic feed vulnerable to inheriting the previous country's league group when the current country had no competition heading.
- Commit `269e85f78b0d7a608fd6d1a1c4c339d646c663a7` adds shared `supabase/functions/_shared/footynomad-section.ts` and uses it in BOTH Edge Functions. A league group is accepted only if it follows the current country heading; missing competition remains null and is rejected by scope filters.
- Added two regression tests in `src/lib/domain.test.ts`: missing league heading cannot inherit the previous country's league; a league group after the current country heading is accepted.
- Supabase `moneyball-free-feed` deployed v45 and `footynomad-sync` deployed v90, both `verify_jwt=true`. CI run `44056482857` SUCCESS; Cloudflare MAIN Worker deploy `44056483454` SUCCESS.
- Triggered the real automatic feed through the existing cron-authenticated endpoint (HTTP request id 3964). Response HTTP 200: date 2026-11-17, reported fixtures 2, inserted 0, updated 2. The production feed table contains exactly two fixtures: Warrenpoint Town–Glenavon FC and Rathfriland–Moyola Park, both Northern Ireland Championship, scheduled 19:45 UTC. This is a real production feed refresh, not a mock.

### Prediction and results views aligned with canonical scope
- Found `moneyball_predictions_page` and `moneyball_results_page` did not apply the same European senior-men tier-1/tier-2 predicate already used by dashboard summary, selected picks and the match screen. This could expose legacy out-of-scope predictions/results in those two views.
- Migration `20261117110000_filter_prediction_and_results_views_to_european_top_two.sql` applied. It joins predictions to their match and applies `moneyball_is_eligible_european_match` plus senior-men scope in the prediction base CTE; results page applies the same filter to its match window. No historical rows, coupons, settlements or bankroll transactions were deleted or modified.
- Production RPC regression under the owner's auth context: first prediction page had 0 ineligible rows; first results page had 0 ineligible rows.
- GitHub CI `44056784876` SUCCESS; Cloudflare MAIN Worker deploy `44056784923` SUCCESS for commit `6ec923fc`. The app's `/` and `/login` routes load; `/panel` correctly remains protected and reports `login_required` without an authenticated session.

### Production day scope and outstanding proof
- 17 Nov database snapshot: 99 FootyNomad-sourced match rows for the day; exactly 2 pass the canonical eligibility predicate. Those two are the Northern Ireland Championship fixtures listed above. The remaining 97 are out-of-scope competitions/tiers (cups, youth, reserves, lower divisions, international matches etc.) and are not valid candidates. Existing legacy rows are preserved; current match, prediction and results views now filter them.
- Existing authenticated `mecze` page has separate '1. Szukaj meczów' (`footynomad-sync`) and '2. Analizuj' (`moneyball-predict`) actions, both using `brusselsDayKey(new Date())`. The automatic public feed refreshes independently every 15 minutes.
- The 17 Nov 09:33 UTC automatic feed refresh verified v45 in production. `footynomad-sync` v90 has been deployed, but no post-v90 authenticated user-triggered sync was performed from this audit; the database import through that authenticated path still needs end-to-end verification.
- Issue #77 remains OPEN. Continue source-vs-import comparison on dated FootyNomad pages and run the authenticated MAIN search/analysis from the user's session. Do not declare the app/project complete yet.
## Settlement-history read model scope fix — 2026-11-17
- Follow-up audit found `moneyball_history_page` (the pending/done settlement queue) also lacked the canonical Europe/senior-men/tier-1-or-2 predicate, although statistics, dashboard and match screen were already scoped.
- Migration `20261117111000_filter_history_page_to_european_top_two.sql` applied. It filters the history candidates CTE to eligible European senior men's domestic tier-1/2 matches. It does not delete or change any underlying match, prediction, result, coupon, leg, settlement or bankroll record.
- Auth-context SQL regression after migration: `todo_count=0`, `done_count=80`, and 0 ineligible rows on the returned done page. Zero todo is the actual current queue state, not a failed query.
- Current read-model scope now consistent across predictions page, results page, settlement history, dashboard, statistics and match list. Saved coupon/finance history is intentionally preserved.
## European source discovery expanded to 53/55 — 2026-11-17

New detailed audit: `docs/EUROPEAN_SOURCE_AUDIT_2026-11-17.md`. Official current 2026/27 sources were verified for 16 previously uncovered associations: Albania, Andorra, Armenia, Bosnia and Herzegovina, Faroe Islands, Georgia, Gibraltar, Iceland, Israel, Kosovo, Luxembourg, Malta, Moldova, Montenegro, North Macedonia and San Marino. Combined source evidence rises from at least 37/55 to 53/55 UEFA associations. Belarus remains the only country with a domestic league for which no current public fixture source was verified; Liechtenstein has no national league and its clubs play in the Swiss pyramid.

Canonical frontend, both Edge Function filters and SQL predicate aliases were updated for current official names: Abissnet Superiore; Lliga Multisegur Assegurances/Lliga Grup Pirineu; WWIN Liga Bosne i Hercegovine; Meistaradeildin/1. deild menn; Erovnuli Liga 2; Gibraltar Football League; Lengjudeild karla; Ligat Winner; Albi Mall Superliga; BGL Ligue/Promotion d'Honneur; VBet Malta Premier League; Liga 7777; Meridianbet 1. CFL; Prva/Vtora MFL. Existing aliases already covered Armenian Premier League and Campionato Sammarinese. SQL alias migrations applied through `20261117117000`; Edge Functions now deployed as moneyball-free-feed v50 and footynomad-sync v97.

Important: 53/55 is verified source-discovery coverage, NOT automated importer coverage. Official sources are not integrated as feed adapters until legal terms and stable no-key data access are checked. Production FootyNomad feed regression still returns exactly two eligible 17 Nov matches with HTTP 200.
## Correction: Belarus source found; coverage 54/55 — 2026-11-17
- Follow-up inspection of FootyNomad's 21 Nov 2026 page found Belarus `Premier League` (8 matches) and `1. Division` (9 raw matches). Production `footynomad-sync` v97 GET returned 8 top-tier fixtures plus 6 senior second-tier fixtures after excluding 3 reserve-team fixtures.
- Production parser GET for 21 Nov returned 301 fixtures across 43 countries; all 301/301 passed the canonical SQL `moneyball_is_eligible_european_match` predicate. Belarus's 14 returned fixtures also all pass.
- Combined source-discovery evidence is therefore 54/55 UEFA associations, not 53/55. Liechtenstein is the sole association without a national league; its clubs play in the Swiss pyramid, and the national cup is out of scope.
- This validates the dated source response and eligibility parser only; the authenticated POST/import into the owner's database remains unverified after the latest `footynomad-sync` deployment.

## 17.11.2026 — geographic Europe scope correction (UN M49)
- Root cause: frontend `EUROPEAN_COUNTRIES` treated UEFA membership as geographic Europe. It explicitly admitted Israel/ISR and also several countries assigned by the UN M49 standard to Asia: Armenia, Azerbaijan, Cyprus, Georgia, Kazakhstan and Türkiye. Existing regression tests even asserted Israel and Georgia as eligible, so this was a genuine policy/test defect, not merely a provider naming issue.
- Corrected the canonical frontend country allowlist in `src/lib/domain.ts` to follow the UN Statistics Division M49 Europe region. This country gate is shared by the match list, Statistics, OpenMatchday source-folder validation and coupon-candidate eligibility. The country gate is evaluated before league-name aliases, so an Asian country cannot enter by having a league label that resembles a European tier.
- Added/updated regressions: Albania/ALB remains eligible; Israel/ISR, Armenia/ARM, Azerbaijan, Cyprus, Georgia, Kazakhstan and Türkiye are rejected even when the competition label looks like a top-tier league. This also prevents the previous false-positive test from returning.
- Historical database records are not deleted or rewritten. The change filters current application eligibility/views and candidate generation; importer/database-side filtering still needs a corresponding production migration/function deployment. This task is constrained to GitHub + Cloudflare, so no Supabase migration or Edge Function deployment is claimed here.
- Authority: UN Statistics Division M49 lists Albania in Southern Europe and Israel, Cyprus, Armenia, Azerbaijan, Georgia and Türkiye in Western Asia; Kazakhstan is in Central Asia. https://unstats.un.org/unsd/methodology/m49/overview
- Pending verification after CI/deploy: all UI routes and candidate surfaces use the canonical helper; production Worker must be tested after the Cloudflare workflow completes. Do not claim that backend ingestion has been geo-filtered until its runtime is separately deployed and verified.


## 17.11.2026 — follow-up: align catalogue regression suite with geographic scope
- CI #1219 and Cloudflare workflow #805 both reached the test stage and correctly failed before build/deploy. The failures were test assumptions, not a TypeScript/runtime failure: one stale positive assertion still accepted Türkiye 1. Lig; the 110-entry FootyNomad test fixture was explicitly a UEFA catalogue and still treated Armenia as a required European country.
- Repaired the test contract rather than weakening/disabling tests: removed Armenia, Azerbaijan, Cyprus, Georgia, Israel/ISR, Kazakhstan and Turkey provider labels from the accepted fixture catalogue; renamed the suite to geographic Europe (UN M49); changed Türkiye 1. Lig to rejected. Separate targeted regressions continue to assert Albania/ALB accepted and Israel/ISR plus other Asian countries rejected.
- The first failed CI prevented the Cloudflare deploy, so commit 6467831 was NOT deployed. Follow-up commit contains the corrected tests; await a fresh successful CI and Cloudflare MAIN deploy before treating the frontend change as live.


## 17.11.2026 — follow-up regression pass 2
- CI #1220 / Cloudflare #806 passed the broad provider catalogue after removing the Asia/UEFA-only fixtures, but one remaining direct `isEligibleEuropeanMatch(Georgia, Erovnuli Liga 2)` assertion still expected true. This was the last stale positive test found by the suite (73/74 tests passed).
- Changed that assertion to false, aligning both the top-two helper and the full match eligibility helper with the same M49 country gate. No tests were disabled. A new CI/Cloudflare run is required; the failed run did not deploy.


## 17.11.2026 — follow-up regression pass 3
- CI #1221 found one final stale test at the OpenMatchday source-folder path: an explicit `om:ISR_2_...` tier folder was expected to override the country filter. This exposed an important edge case: provider tier metadata must never override geography.
- Updated the regression to require rejection even when the source folder explicitly labels Israel as tier 2. This is not a code relaxation; it strengthens the geographic gate test. The source-country allowlist remains the single deciding condition.
- Three successive test runs exposed three distinct stale UEFA-era assumptions (110-entry catalogue, Georgia eligibility, explicit ISR OpenMatchday slug). Keep this history; do not repeat those diagnostics. CI #1221 did not deploy.


## 17.11.2026 — follow-up regression pass 4
- CI #1222 / Cloudflare #808 exposed additional legacy positive assertions in a later test block, beyond the 110-row provider catalogue: Turkey TFF First League, Israel Liga Leumit/Winner League/Ligat Winner, Georgia Erovnuli Liga 2, Azerbaijan Birinci Liqa, Kazakhstan First Division and Cyprus Second Division were all still marked true.
- Corrected every stale positive assertion in that block to false. Earlier run failures were therefore a broad mismatch between old UEFA-based fixtures and the new geographic contract; they were not repeated production code defects. The canonical helper remains unchanged. No test has been skipped or disabled.
- CI #1222 failed only at the tests stage; Cloudflare did not deploy. This follow-up requires a fresh full CI + Cloudflare deployment.


## 17.11.2026 — exhaustive stale-country assertion sweep
- A final source-wide scan of `src/lib/domain.test.ts` found one duplicate Israel `Liga Leumit` positive assertion remained because an earlier replacement changed only the first duplicate occurrence. Replaced all remaining positive assertions for Asia-classified countries/codes (Armenia, Azerbaijan, Cyprus, Georgia, Israel, Kazakhstan, Turkey/Türkiye and ISO-3 variants) with negative expectations. Albania is deliberately untouched and remains positive.
- This is the final cleanup of duplicated UEFA-era test examples. The next CI run must prove zero stale positives remain; do not deploy before full success.


## 17.11.2026 — dashboard selected-picks geographic guard
- Cross-screen audit found the Matches page, Statistics page and coupon candidate logic use the canonical frontend geographic-Europe helper, but the MAIN panel's selected-picks RPC returns flattened pick rows without country/gender fields. That made it impossible for the panel component to independently enforce geography and left a potential dashboard leak if a legacy SQL RPC returned an Israel/Asia pick.
- Fixed `fetchDashboardSelectedPicks` in `src/lib/db.ts`: after the date-scoped RPC returns its small list, fetch only the referenced match IDs through the existing owner-scoped `fetchMatchesByIds`, apply `isEligibleEuropeanMatch`, and return picks only for eligible match IDs. No full-table read, no new unscoped query, and no changes to history or bankroll.
- This closes the remaining client-rendered selected-pick list without touching Supabase or rewriting historical rows. SQL summary aggregates and backend importers remain subject to the explicit deployment limitation documented above.


## 17.11.2026 — complete client-view geographic gate across match surfaces
- After the first production deployment, a cross-screen audit found that the canonical M49 helper was already used by Matches, Statistics, coupon candidate selection and the MAIN dashboard selected-picks list, but paginated Predictions/Results/History RPCs and saved coupon history could still return flattened or joined records under the old UEFA SQL country scope.
- Added client-side geographic gates at the data boundary: today's match-page query filters before fetching related picks; coupon-page data filters today's candidate matches and returns only coupons whose every leg belongs to an eligible European match; results and settlement-history page rows are filtered by their joined match; PredictionsView filters page rows after its existing owner-scoped match-ID lookup and limits the manual prediction form's match choices to eligible European matches.
- The filter uses the same `isEligibleEuropeanMatch` helper, so the league tier, senior-men and reserve-team rules remain intact alongside the M49 country boundary. Historical records are not deleted or rewritten. Pagination cursors and server aggregates remain from the backend RPC; visible row lists are filtered at the UI boundary.
- This remains a frontend enforcement layer. Automatic ingestion and DB-side aggregates can still persist/use non-European records until their separate backend runtime is migrated/deployed; no such deployment is claimed under the Cloudflare/GitHub-only restriction.


## 2026-11-17 — geographic Europe frontend scope deployed

- Adopted the UN Statistics Division M49 regional classification for the meaning of geographic Europe. Albania is included (Southern Europe); Israel, Armenia, Azerbaijan, Cyprus, Georgia and Türkiye are excluded (Western Asia); Kazakhstan is excluded (Central Asia). UEFA membership is not used as a substitute for geography.
- Canonical frontend helper in `src/lib/domain.ts` is used by Matches, Statistics and coupon candidate selection. Follow-up guards were added to MAIN dashboard selected picks, Predictions, Results, History/settlement and saved coupon data. The match page and coupon candidate query filter today's fixtures before loading associated predictions.
- Regression tests initially exposed stale positive assumptions from the old UEFA-based catalogue (110-row accepted fixture set, Georgia/Israel/Türkiye assertions, and explicit OpenMatchday ISR slug). These were corrected without disabling tests. Final CI #1226 passed tests, Deno type-check, TypeScript and build.
- Cloudflare MAIN deploy #812 succeeded for commit `8a3f98665a416a28ba277304680931dec394e103`; Worker version `44c4f0cd-ca34-4c30-b61a-53d621f72125`. Live root and /login fetch succeeded; protected /panel returned `login_required` without an authenticated session.
- No historical match, prediction, coupon, settlement or bankroll data was deleted or rewritten.
- **Critical boundary:** this was a Cloudflare frontend/client-side data-scope deployment. Supabase automatic importers, SQL eligibility functions and aggregate RPCs were not deployed with the M49 change. Backend ingestion/aggregate isolation is not yet proven. The app filters visible rows, but non-European records may still be stored or included in some backend aggregates until the backend runtime is separately updated and verified. Keep issue #77 OPEN; do not claim full project completion.


## Regression log — backend M49 country gate (2026-11-17)

**Bug:** Frontend geographic Europe filter and Supabase ingestion/database rules diverged. Five backend functions retained the old UEFA-based allowlist, including Asian countries and a competition-name fallback that could bypass country geography.

**Fix in source:** Shared helper `supabase/functions/_shared/geographic-europe.ts`; updated `footynomad-sync`, `moneyball-free-feed`, `moneyball-results-sync`, `moneyball-public-sources`, `moneyball-predict`, and `moneyball-movi-odds-sync`; OpenMatchday league-index filter now uses the same helper. Added `geographic-europe.test.ts` and wired `deno test --no-check supabase/functions/_shared/geographic-europe.test.ts` into CI and Cloudflare deployment validation. Added SQL migration `20261117130000_enforce_geographic_europe_m49_scope.sql` with database regression assertions.

**Country policy:** UN M49 is the geographic reference. Albania remains included. Israel, Armenia, Azerbaijan, Cyprus, Georgia, Kazakhstan and Türkiye are excluded. UK football associations and Kosovo are explicit provider aliases; Kosovo is not a separate M49 country code. Generic `Europe` and `UEFA` labels are not accepted as country evidence.

**Commits:** `b7d32c841195a9d6fddd756fac1ba22186f4420e`, `1d0479af049cc27f0184c8044e7ae3f7964e2f47`, `7edd8668d6f4a1f269c64b21d302708a62e499b0`, `63a5edaa6cf99a2894aa90e67ff1f04e8c153e0d`.

**Not yet done:** The Supabase Edge Functions and SQL migration have not been deployed to the live Supabase project. The Cloudflare workflow is not a Supabase deploy. Live importer/database verification remains open; do not repeat the earlier overclaim that frontend filtering means source ingestion is fully geographic. Existing historical rows remain untouched.


**CI/deployment result:** GitHub Actions CI #1230 SUCCESS and Cloudflare deploy #816 SUCCESS for `63a5edaa6cf99a2894aa90e67ff1f04e8c153e0d`. New Deno country-scope tests, Edge Function type-check, application tests, TypeScript, build and Cloudflare deployment all passed. Supabase runtime deployment remains outstanding.


**Final source/Cloudflare validation:** Deno scope tests, Edge Function type-check, application tests, TypeScript and build passed in CI #1231 and #1232. Cloudflare deploy #818 SUCCESS for `effa5063e006a40f30da26f3981987e9153865c5`. The odds-sync function now also rejects matches outside the shared geographic country gate. Supabase functions and SQL migration remain source-only and are not live.


## Manual fixture search HTTP 400 root-cause — 2026-11-17

- User screenshot showed Supabase Edge Function non-2xx during the manual match search.
- Read-only production logs confirmed `POST /functions/v1/footynomad-sync` returned HTTP 400 twice at 2026-11-17 10:31:33Z and 10:31:37Z (Belgium 11:31). The adjacent `moneyball-public-sources` call returned HTTP 200. Results-sync logs independently reported 173 FootyNomad fixtures for 2026-11-17. Thus the public fixture sources were reachable; the failure occurred in the authenticated import path.
- Production function version 97 and the main-branch source contained `req.headers.get("Authorization")?.replace(/^Bearer\\\\s+/i, "")` (two literal backslashes in the regex). It does not strip the normal `Bearer ` prefix. The function then forwards `Authorization: Bearer ` plus that unstripped value to PostgREST. This explains a downstream authorization failure surfaced as HTTP 400 by the function's outer catch. The exact DB error body is not retained in the function logs, so treat this as the strongly evidenced root cause, not a claim that the downstream 401 body was directly captured.
- Fixed source by adding shared `extractBearerToken` helper and tests (standard, case-insensitive, raw token, missing header), and wired tests into CI. Updated the match-screen error handler to read the Edge Function response body and show HTTP status plus the actual error, rather than the generic SDK non-2xx message.
- Commit: `5ff5fc72050dc3265d5203c6226d86061ffa960a`. CI #1233 and Cloudflare deploy #819 were running when this note was prepared.
- **Production activation remains pending:** the failing request is handled by Supabase Edge Function `footynomad-sync` (project `gzgeklcukrclgwbsmbsp`, active version 97). A Cloudflare Worker deploy cannot replace this function. Under the project's established Cloudflare/GitHub-only deployment constraint, do not deploy directly to Supabase. The source fix must be activated through the authorized Supabase deployment path before a live retry can confirm recovery.


**Validation update:** CI #1233 SUCCESS and Cloudflare deploy #819 SUCCESS for `5ff5fc72050dc3265d5203c6226d86061ffa960a`. The bearer-token helper tests, geographic scope tests, Edge Function type-check, app tests, TypeScript and build passed. Cloudflare deployment updates the client error detail display; it does not activate the corrected `footynomad-sync` on Supabase. Production Edge Function version was confirmed as 97 during diagnosis; live recovery is not yet verified.


## Supabase production activation — footynomad-sync v99 — 2026-11-17

- User explicitly authorized a one-time production deployment of the corrected `footynomad-sync` to Supabase project `gzgeklcukrclgwbsmbsp`.
- Before deployment, verified the live function was version 97, ACTIVE, with `verify_jwt=true`. Its active source still had the malformed Bearer regex and only the old `footynomad-section` dependency. Read-only logs showed two POST 400 responses on 2026-11-17 10:31:33Z and 10:31:37Z, both against deployment v97; public-source requests returned 200. Prior log query did not retain the inner function exception body, so the bad token normalization is the strongest source-level cause, not a directly observed PostgREST error body.
- A first deployment attempt failed bundle resolution due to relative helper path layout; no successful runtime activation was assumed from that attempt. A second deploy attempt produced v98 with a duplicated entrypoint path, which was immediately superseded. The final successful deployment is v99, using a self-contained one-file bundle generated from the committed MAIN source plus its exact shared helper contents. This avoids runtime relative-import resolution failures.
- Verified live metadata after deployment: function `footynomad-sync` status ACTIVE, version 99, `verify_jwt=true`, entrypoint `source/index.ts`, single deployed file `index.ts`. The bundle includes the corrected Bearer extraction and M49 country filter. No auth setting was weakened and no database rows were deleted/rewritten.
- Cloudflare MAIN remains deployed at commit `5ff5fc72050dc3265d5203c6226d86061ffa960a`; CI #1233 and Cloudflare deploy #819 succeeded. Documentation was updated on MAIN after the live activation.
- **Still required for end-to-end proof:** a real authenticated POST scan from the app after v99 and inspection of its function logs plus `scan_runs`/matches results. The most recent database scan rows inspected pre-deployment were not a post-v99 test. Do not claim the user's button is fully verified until a post-deploy scan returns 2xx and stores the expected eligible European fixtures.


## All-tier European domestic fixture scope — 2026-11-17

- Latest user request expands match discovery from first/second tier only to ALL senior men's domestic league tiers in geographic Europe (UN M49).
- Still exclude cups/knockouts, international and national-team competitions, youth/U teams, women's competitions, reserve/B/II/III teams, and all non-European countries.
- Root cause of the low count: the previous tier allowlist explicitly rejected lower divisions. The 11:45 Brussels manual request was healthy after footynomad-sync v99 (HTTP 200, completed scan, two stored matches); the count reflected the old scope, not a truncated response.
- Independent FootyNomad review identified previously rejected senior domestic fixtures in France National 2, Czech 3. liga, England National League North/South and Non-League Premier, and Scotland Lowland League. Ukraine Persha Liga fixture UCSA–Polissya II remains excluded as a reserve side.
- Source changes on MAIN: shared domestic-league-scope helper and Deno tests; all-tier filters in footynomad-sync, moneyball-free-feed, moneyball-predict and OpenMatchday catalogue discovery; frontend eligibility and match-screen text updated; SQL migration 20261117150000_expand_european_leagues_to_all_senior_tiers.sql.
- Geographic M49 country boundary is unchanged: Albania included; Israel, Armenia, Azerbaijan, Cyprus, Georgia, Kazakhstan and Türkiye excluded.
- End-to-end verification is still required: CI and Cloudflare MAIN deploy, SQL migration, four Edge Function deployments, then authenticated manual scan checking lower-tier inclusion and cup/international/youth/women/reserve/non-European exclusions. Do not call the task complete until those checks pass.


Final verification trigger: all-tier helper and database migration exclusions hardened on 2026-11-17; final CI/Cloudflare verification must include these last changes before production activation.


### Follow-up audit — live runtime mismatch and all-tier regression hardening (2026-11-17, 12:xx Europe/Brussels)

- Re-read MAIN at HEAD `08fca6c9e4aa8d53c7bc4e2de05b158d3f6692f8`. The all-tier code and migration were already committed; this follow-up does not recreate them.
- Confirmed GitHub CI run `44070206292` SUCCESS and Cloudflare MAIN deploy `44070206451` SUCCESS for that HEAD. Cloudflare deployment is frontend-only; it does not deploy Supabase Edge Functions or SQL migrations.
- Read-only production metadata: `footynomad-sync` ACTIVE v99, `moneyball-free-feed` v50, `moneyball-predict` v246, `moneyball-public-sources` v63. Production migration history ends at `20261117094948`; migration `20261117150000_expand_european_leagues_to_all_senior_tiers` is not applied.
- Read-only production SQL test of the currently active shared predicate returned: France National 2=false, Czech 3. liga=false, England National League North=false, Scotland Lowland League=false, Northern Ireland Championship=true. This proves the production database still enforces the previous first/second-tier scope.
- Public FootyNomad pages for 2026-11-17 independently list lower-tier European domestic fixtures, including France National 2, Czech 3. liga, England National League North/South and Non-League Premier, and Scotland Lowland League. The same pages also include cups, U21/U23/youth, reserve sides and non-European fixtures, which must remain excluded.
- Confirmed current MAIN source already contains all-tier eligibility in `domestic-league-scope.ts`, `moneyball-free-feed`, `moneyball-predict`, `moneyball-public-sources`, frontend `isEuropeanDomesticLeague`, and migration `20261117150000`. The direct FootyNomad importer also uses the shared all-tier predicate; removed its unused legacy top-two helper and renamed the stale OpenMatchday helper for clarity.
- Added end-to-end frontend eligibility regressions for National 2, Czech 3. liga, English National League North and Scottish Lowland League; retained explicit cup rejection. Updated the frontend eligibility comment to describe all senior tiers.
- **Deployment blocker:** under the user's existing GitHub/Cloudflare-only restriction, do not directly deploy Supabase Edge Functions or apply the SQL migration. No Supabase deployment workflow exists in `.github/workflows`; current workflow only builds/deploys Cloudflare. Therefore this commit can validate/deploy Cloudflare, but cannot activate the backend changes. Do not report all-tier discovery as live until the authorized backend activation path is provided.
- No historical matches, predictions, coupons, results or bankroll transactions were deleted or rewritten. Issue #77 remains open.


### Final CI/Cloudflare verification for all-tier frontend commit (2026-11-17)

- Commit `9181ba3c50f0f5d66f1a825bc6b35808c37cfffe` initially failed Deno type-check because the attempted cleanup removed more than the obsolete tier helper from `footynomad-sync`, including runtime declarations (`SUPABASE_URL`, `KEY`, `cors`, `runLimited`, `isEuropeanFixture`). CI blocked deployment as intended; this failed commit was never deployed.
- Corrected by restoring the exact importer from parent MAIN `08fca6c9e4aa8d53c7bc4e2de05b158d3f6692f8` and making only the safe helper-name replacement. No importer configuration or runtime declarations were removed.
- Corrective commit: `9eba11e7d325e392322b4c8b496b6c4e7cb473b6`.
- GitHub CI run #44071134664: SUCCESS — Deno geographic scope tests, all-tier tests, bearer tests, Deno Edge Function type-check, application tests, TypeScript check and build all passed.
- Cloudflare MAIN deploy run #44071134655: SUCCESS — Cloudflare build and Worker deployment passed.
- MAIN now points to `9eba11e7d325e392322b4c8b496b6c4e7cb473b6`. The frontend and client eligibility are deployed. The production Supabase state is unchanged: `footynomad-sync v99`, `moneyball-free-feed v50`, `moneyball-predict v246`, `moneyball-public-sources v63`; SQL migration history still does not contain `20261117150000_expand_european_leagues_to_all_senior_tiers`.
- Consequently, lower-tier eligibility remains false in the live database predicate until the backend migration and matching Edge Function versions are activated through an authorized backend deployment path. Do not repeat a manual scan yet and expect all tiers.
- External fixture evidence: FootyNomad 17 Nov 2026 (`https://footynomad.com/fixtures/2026-11-17`, `https://footynomad.com/list?date=2026-11-17`), OpenMatchday league index (`https://github.com/oladeeayo/open-matchday/blob/master/LEAGUE_INDEX.md`), Non-League Ranking (`https://www.nonleagueranking.com/fixtures.php?Date=2026-11-17&game=all`). These sources support the lower-tier examples; they do not prove exhaustive Europe-wide daily coverage.
- Issue #77 remains OPEN. No historical data, coupon, settlement or bankroll row was deleted or rewritten.


## Backend activation and all-tier production verification — 2026-11-17

### Authorization and deployed backend
- User explicitly authorized production deployment of the all-tier SQL migration and matching Supabase Edge Functions.
- Supabase project: `gzgeklcukrclgwbsmbsp`. No Vercel or TEST environment was used.
- Applied SQL migration `expand_european_leagues_to_all_senior_tiers`, recorded by Supabase as version `20261117112345`.
- Applied regression-only SQL migration `validate_real_fixture_reserve_exclusions`, recorded as `20261117113722`.
- Active Edge Functions after deployment, with existing JWT settings preserved:
  - `footynomad-sync` v100, `verify_jwt=true`
  - `moneyball-free-feed` v52, `verify_jwt=true`
  - `moneyball-predict` v247, `verify_jwt=false`
  - `moneyball-public-sources` v64, `verify_jwt=false`
- All functions deployed as self-contained one-file bundles containing the exact committed shared helper sources. This avoids the earlier relative shared-import bundle-resolution problem. No secrets or auth settings were changed.

### Source audit for 2026-11-17
- FootyNomad day page reported 172 fixtures across 20 countries. Its domestic European senior league headings included:
  - France National 2 — 1 fixture
  - Czech 3. liga - CFL B — 1 fixture
  - England — 21 senior league fixtures across National League North/South and four Non League Premier regional divisions; additionally EFL Trophy (1), Premier League Cup (1), Professional Development League (4), all excluded
  - Northern Ireland Championship — 2 fixtures
  - Scotland Lowland League — 8 fixtures, including Newton Stewart v Celtic II, which is excluded as a reserve side
- The Czech 3. liga fixture was Pardubice II v Horní Ředice; it is correctly excluded because Pardubice II is a reserve team. Thus the FootyNomad accepted count is 31, not 33.
- The accepted 31 comprise England 21, France 1, Northern Ireland 2, Scotland 7.
- Other FootyNomad competitions on the date included international/national-team competitions, U17/U19/U21, non-European domestic leagues, cups and U23. These remain excluded.
- Independent checks: BetExplorer, SportPremi, SKORGOL/Koraview for Pardubice II v Horní Ředice; official Scottish Lowland Football League match centre and Flashscore/SoccerPunter for Lowland fixtures.

### Production feed and database proof
- Scheduled `moneyball-free-feed` run at 2026-11-17 11:31:01 UTC completed successfully and stored 31 FootyNomad fixtures for the Brussels date; 0 missing kickoff timestamps.
- Feed grouping: England National League North 5, National League South 2, Non League Premier Isthmian 4, Northern 4, Southern Central 3, Southern South 3; France National 2 1; Northern Ireland Championship 2; Scotland Lowland League 7.
- Public-source endpoint returned 22 raw fixtures from four sources and 11 eligible geographic-European senior domestic fixtures after filtering; the 11 were OpenMatchday rows. ESPN Nations League and other non-domestic/non-European rows were rejected.
- Production scheduled importer log at 11:35:08 UTC: `feed_rows=31`, `public_rows=11`, `eligible_rows=31`, `inserted=0`, `skipped_existing=31`, `deduplicated_candidates=0`, no feed or public-source error. This confirms the feed rows already existed in the main matches table and were recognized as eligible.
- Main match registry for 2026-11-17: 110 rows for the owner, 43 eligible rows before duplicate collapse, 67 rejected, 11 date-only rows. The prediction page's canonical deduplication yields 40 unique eligible senior men's fixtures (3 duplicate source rows collapsed).
- Live SQL eligibility tests passed: France National 2, England National League North, Scotland Lowland League, Northern Ireland Championship accepted; Albania accepted; Israel/Türkiye/Cyprus and World/Nations League, EFL Trophy, U23 and reserve sides rejected.
- Regression discovered and fixed in validation: synthetic team name `Club B` looked like a B-team suffix and was correctly rejected; senior-league validation fixtures now use neutral team names. Actual reserve checks for Pardubice II and Celtic II pass as excluded.

### Production prediction scan
- The prior scan state had been marked completed after only 2 fixtures and a 6-hour cooldown. After confirming no active lease, the current-day scan's `next_scan_at` was advanced to now (no match/history/coupon/bankroll rows were changed) so the existing minute scheduler could reprocess the full day.
- Scheduled `moneyball-predict` production scan completed successfully: 4 batches, 40 fixtures processed, status `completed`, no error, lease released. Next scheduled run is 2026-11-17 14:00 UTC = 15:00 Europe/Brussels.
- For all 40 canonical eligible fixtures, database verification found: 40/40 have a 1X2 prediction, 40/40 have all three separate Double Chance selections, and 40/40 have at least one Goals prediction.
- The model's weak predictions remain recorded as `ODRZUCONY`; they are not silently omitted. No coupon or bankroll data was altered by this task.

### Cloudflare MAIN and UI smoke test
- Latest code commit before this documentation update: `5ab413e6f05c6ae9c63307bb4bc6e3797413e000`.
- GitHub CI #44075655027 SUCCESS; Cloudflare MAIN deploy #44075655122 SUCCESS.
- Production Worker root and `/login` return the expected app pages. Unauthenticated `/panel` and `/mecze` correctly return `login_required`.
- Frontend geographic/all-tier filtering is deployed and covered by CI. A signed-in visual browser session was not available during this run, so the final authenticated screen-level check remains open; do not claim that visual session was performed.
- Supabase advisors show existing unrelated warnings (service-only RLS tables without user policies, pg_net in public, selected SECURITY DEFINER RPCs, leaked-password protection disabled). No unrelated security policy, auth setting, or extension was changed in this repair.

### Remaining completion check
- Verify next scheduled `moneyball-free-feed` refresh uses v52's updated all-tier audit note.
- Perform an authenticated click-through of the app's Matches and Predictions screens after the user signs in, confirming the 40 canonical fixtures are visible and non-European/cup/youth/women/reserve rows are hidden.
- Keep issue #77 open until that authenticated UI check is completed. Overall MONEYBALL GLOBAL is not declared finished by this fixture-scope repair alone.


### Country-alias parity and final feed refresh — 2026-11-17

- Added Bosnia & Herzegovina / Bosnia-Herzegovina aliases to shared TypeScript and frontend geographic-Europe country sets. SQL country matching now applies Unicode NFD normalization before matching aliases; Åland Islands is handled consistently. Israel and Türkiye remain excluded.
- Applied SQL migration `normalize_geographic_europe_country_aliases`, Supabase version `20261117114432`. Live SQL proof: Bosnia & Herzegovina=true, Bosnia-Herzegovina=true, Åland Islands=true, Bosnia domestic league=true, Israel=false, Türkiye=false.
- Redeployed backend functions from current MAIN sources. Active versions: `footynomad-sync v101` (JWT true), `moneyball-free-feed v53` (JWT true), `moneyball-predict v248` (JWT false), `moneyball-public-sources v65` (JWT false). Existing JWT settings preserved.
- Scheduled feed refresh 2026-11-17 11:46:02 UTC succeeded with 31/31 eligible FootyNomad fixtures and the updated note confirming all senior domestic league tiers. No stale/non-matching cache rows were removed.
- Post-deploy public-sources smoke test: ok=true, 22 raw fixtures, 11 eligible European senior domestic fixtures; all returned rows pass country/gender scope.
- Latest code commit `07b2111e0aadd8c4d86edb3b3c23c56febd37c5d`; CI #44076707101 SUCCESS; Cloudflare MAIN deploy #44076707261 SUCCESS.
- Older issue #76 (tier 1/2 only) is closed as superseded by broader all-tier issue #77. Issue #77 remains open only for authenticated UI screen verification.


## Prediction screen coupon-reference query optimization — 2026-11-17 11:58 UTC

- A fresh source audit found `PredictionsView` still loaded the complete `coupon_legs` table solely to protect edit/delete actions for visible predictions. This defeated part of the server-side prediction pagination and could grow with coupon history.
- Added `fetchCouponLegsByPredictionIds()` in `src/lib/db.ts`: owner-scoped, deduplicated, chunked requests limited to the prediction IDs displayed in the currently loaded prediction pages. Empty ID lists return without a database request.
- Added `predictionCouponLegsQuery()` in `src/lib/queries.ts`, keyed by sorted visible prediction IDs. Updated `PredictionsView` to use this query rather than `tableQuery("coupon_legs")`; edit/delete remains blocked until relevant coupon references are loaded and still prevents deleting any prediction used by a coupon.
- Added query invalidation for `prediction-coupon-legs` to both success and error paths in `useAction`, so coupon creation/cancellation and partial multi-step failures cannot leave the safety guard stale.
- Source re-read from `main` confirms the old full-table `tableQuery("coupon_legs")` call is absent from `PredictionsView`, helper/query wiring exists, and both mutation invalidation paths include the scoped key.
- Code commits: `1b14f0e3ada4efd348fdce67b4e917804ac20e95`, `34e68c535a572d4af03f4b8eb8f2e3d71f6d4151`, `724f79a390f9ec0845eb02b7af65105c1e0552d6`, `86855aacb4dc350f8285b02ce04ea979635a43b2`.
- Validation status: source-level checks only. No CI/Vitest/TypeScript/build result has yet been retrieved for these commits; the combined GitHub commit-status endpoint currently exposes only the unrelated Vercel build-rate-limit failure, which is not the production host. No Cloudflare deployment is claimed. Run the repository CI and Cloudflare MAIN deployment, then verify the exact deployed SHA and authenticated prediction screen.
- Browser automation for authenticated production UI is currently blocked: the available browser profile has no recorded sign-in for the Worker domain and the browser automation wallet returned a zero balance. Do not attempt to bypass login or change user data; obtain a user-provided authenticated screenshot or explicit sign-in setup before that visual acceptance test.
- Preserve all prediction/coupon/history/settlement/bankroll records. This change only narrows reads and invalidates cached references.
