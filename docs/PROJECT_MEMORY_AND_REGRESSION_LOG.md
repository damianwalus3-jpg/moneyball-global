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
