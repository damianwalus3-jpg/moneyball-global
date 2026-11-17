# MONEYBALL GLOBAL — indeks historii projektu i decyzji

Ostatnia aktualizacja: 2026-11-17 (Europe/Brussels)

Ten plik jest krótkim indeksem ciągłości. Przed każdą sesją należy odczytać go razem z:
- `docs/PROJECT_STATE.md` — aktualna architektura, stan produkcji, dowody testów i zadania otwarte.
- `docs/PROJECT_MEMORY_AND_REGRESSION_LOG.md` — trwałe wymagania użytkownika, historia błędów, migracje, testy i wdrożenia.
- `README.md` — opis produktu i architektury.
- Historią commitów `main` — źródło prawdy o faktycznym kodzie.

Nie powtarzać audytów i napraw już oznaczonych jako wykonane; przed zmianą zawsze sprawdzić commit, migrację i stan produkcji.

## Znaczenie „oddzielnej / niezależnej aplikacji”

Użytkownik wielokrotnie i jednoznacznie wymagał, aby MONEYBALL GLOBAL:
- było własną, odrębną aplikacją z własnym kodem, interfejsem, adresem i wdrożeniem;
- działało bez Lovable i bez zależności od kreatora no-code;
- było utrzymywane w repozytorium `damianwalus3-jpg/moneyball-global`, branch `main`, i publikowane na istniejącym Cloudflare Worker `moneyball-global`;
- nie wracało do Vercel ani projektu TEST;
- nie wymagało od użytkownika otwierania Supabase do codziennego korzystania z aplikacji;
- korzystało z istniejącego Supabase `gzgeklcukrclgwbsmbsp` jako własnego backendu logowania i danych; nie tworzyć nowej bazy i nie przenosić historii;
- nie wymagało płatnych API ani nowych kluczy dostawców bez zgody; wykorzystywać publiczne źródła, a braki danych oznaczać jawnie.

„Niezależna aplikacja” oznacza samodzielny produkt webowy niezależny od Lovable/Vercel i innych builderów, a nie aplikację offline bez backendu. Cloudflare Worker jest hostem aplikacji, istniejący Supabase jest jej backendem. Użytkownik korzysta z jednego adresu aplikacji.

## Chronologia rozmów i decyzji — skrót

### 2026-09
- Wcześniejszy eksperyment Android/Bet Analyzer w Termux/Android był odrębnym, starszym wątkiem. Nie jest aktualnym targetem produkcyjnym MONEYBALL GLOBAL.

### 2026-11-10
- Użytkownik wymagał przebudowy bez Lovable, bez kupowania kredytów i bez płatnych API/kluczy.
- Zachować dane i bazę; nie tworzyć drugiego równoległego produktu ani nie wymagać korzystania z Supabase UI.
- Rozważono Cloudflare + GitHub + Supabase; później ustalono obecny Worker i istniejący projekt Supabase jako jedną aplikację.

### 2026-11-11–13
- Priorytet: stabilny dostęp/logowanie/reset hasła, przypisanie bukmachera do kursu, poprawne wypłaty i rozliczenia.
- Wcześniej istniała reguła stawki 5 EUR; została później zastąpiona bieżącą regułą 4 EUR dla nowych typów/kuponów. Nie przepisywać historycznych stawek.

### 2026-11-15
- Użytkownik jednoznacznie wskazał MAIN jako jedyną aplikację; TEST porzucić.
- Produkcja: Cloudflare Worker MAIN; nie wracać do Vercel.
- Ostatnie otwarte prace dotyczyły timeoutów sesji/zapytań, ograniczenia retry i polling.

### 2026-11-16
- Usuwanie timeoutów historii predykcji przez mniejsze strony keyset, indeksy i ograniczenie równoległości; nie wracać do pełnych zrzutów dużych tabel.
- Server-side pagination dla predykcji, wyników i historii oraz scoped reads; nadal trzeba przejrzeć wszystkie pozostałe ekrany pod kątem full-table reads.
- Poprawki idempotencji kuponów, ledgeru i automatycznego rozliczania; wcześniejszy test rozliczania przeszedł.
- Ustalono dzisiejszy zakres europejskich lig mężczyzn poziomu 1–2 i zachowanie historii poza zakresem.
- Aktualna stawka analityczna dla nowych typów i kuponów: 4 EUR; nie modyfikować wstecz starych stawek.

### 2026-11-17
- Naprawy importu FootyNomad/OpenMatchday, filtra lig, kursów ręcznych, walidacji URL i autoryzacji źródeł publicznych.
- Audyt produkcji ujawnił niewystarczające pokrycie lig, brak świeżych kursów, brak realnego xG dla dwóch kwalifikujących się meczów i brak potwierdzonych składów.
- Naprawiono zakres statystyk oraz kolejność hooków React.
- Wykryto rozjazd domyślnej stawki w bazie (5 EUR) względem aktualnej reguły 4 EUR; poprawiono default i ścieżki ręcznego zatwierdzania.
- MoviOdds bez klucza nie może wykonywać bezsensownych zapytań ani generować 500; dodano bezpieczny status skipped.

## Stałe reguły, których nie zmieniać bez wyraźnej zgody

- Tylko MAIN: `damianwalus3-jpg/moneyball-global`, `main`, Cloudflare Worker `https://moneyball-global.damianwalus3.workers.dev/`.
- Istniejący Supabase project `gzgeklcukrclgwbsmbsp`; brak nowego projektu/bazy.
- Brak Lovable, Vercel, płatnych API i kluczy bez zgody.
- Dzisiaj wg `Europe/Brussels`; europejskie krajowe ligi mężczyzn, poziom 1 i 2. Wykluczać puchary, rozgrywki międzynarodowe, kobiety, młodzież, rezerwy i niższe poziomy.
- Nie usuwać historycznych meczów, predykcji, kuponów, nóg, wyników ani transakcji.
- 1X2, Double Chance i GOALS to osobne rynki. Kandydat kuponowy wymaga >75% i aktualnego, potwierdzonego kursu; kupony dokładnie 3 różne mecze.
- Nowe wybrane single i kupony: stawka wirtualna 4 EUR. Historyczne stawki zachować.
- Nie fabrykować kursów, xG, składów, kontuzji ani wyników. Fair odds nie są kursem wypłaty.
- Nie deklarować gotowości bez CI, Cloudflare deploy i zalogowanych testów E2E.

## Bieżące priorytety — 2026-11-17
1. Potwierdzić CI i deploy Cloudflare dla najnowszego commitu z poprawką stawki i formularzy.
2. Wykonać bezpieczny test ręcznej promocji typu: stawka 4 EUR, potential return, wynik i statystyki; bez zapisywania fikcyjnego kuponu.
3. Potwierdzić następny zaplanowany skan 15:00 Brussels po zmianie `moneyball-predict v243` i `moneyball-public-sources v62`; oczekiwane `public_source_error=null`.
4. Potwierdzić `moneyball-movi-odds-sync v7` odpowiada skipped bez błędu, gdy klucz nie jest skonfigurowany.
5. Dokończyć przegląd wszystkich ekranów pod kątem pełnych odczytów tabel i paginacji.
6. Zbadać brak świeżych kursów i rozszerzyć darmowe pokrycie europejskich lig, bez obchodzenia ograniczeń dostawców.
7. Dokończyć zalogowane E2E: import → predykcja → kupon 3-leg 4 EUR → wynik → ledger → statystyki.

## Jak utrzymywać ciągłość
- Przed rozpoczęciem sesji: odczytaj ten indeks, końcówkę `PROJECT_STATE.md`, końcówkę `PROJECT_MEMORY_AND_REGRESSION_LOG.md`, ostatnie commity `main`, aktywne wersje Edge Functions i aktualny status Cloudflare.
- Po każdym potwierdzonym fixie: zapisz commit, migrację, test, wdrożenie, wynik runtime i nierozwiązane ryzyka w obu dokumentach.
- Jeśli test lub deploy jest w toku, oznacz go jako pending/in progress; nigdy nie wpisuj SUCCESS przed wynikiem.
- W razie sprzeczności historii i stanu live, prawdą jest aktualny kod + baza + logi produkcyjne; historię zachowaj jako kontekst, nie jako dowód obecnego działania.


## Continuity automation — 2026-11-17
The existing daily 08:15 Brussels audit automation (`6afbeb034e4c81919dd6ad7d554497e0`) now explicitly reads this index, PROJECT_STATE, PROJECT_MEMORY_AND_REGRESSION_LOG and README before work, checks prior project conversations when available, and avoids repeating verified work. Keep its schedule unchanged.


## Free fixture-source research — 2026-11-17
OpenFootball's current 2026/27 mirror has limited league coverage and no 17 Nov fixtures in the checked files; TheSportsDB free day endpoint caps at 3 and returned only UEFA Nations League; OpenMatchday checked eligible folders returned no domestic fixture for that date. FootyNomad's two domestic fixtures may therefore be a genuinely sparse international-window day, not a proven import failure. Do not force extra out-of-scope matches into the app. Full source notes and URLs are in PROJECT_STATE.


## Coupon finance and single-pick repair — 2026-11-17
- Fixed the single-pick path end-to-end: saveCouponBatch accepts exactly 1 or 3 legs; MAIN single saves stake EUR 4 and records the bankroll stake immediately; database trigger allows target_legs=1 only for MAIN.
- Added coupon_legs.match_id NOT NULL and unique (coupon_id, match_id) index to enforce one match per coupon.
- Rollback-only production SQL integration tests passed for single and 3-leg settlement, one stake/one return, and duplicate-match rejection. No test rows persisted.
- Coupon ledger verified: 9 transactions, balance EUR 84.28, 0 balance_after mismatches. First inflated aggregate was a SQL join fan-out false positive, not duplicate data.
- Full technical details and commits are in PROJECT_STATE and PROJECT_MEMORY_AND_REGRESSION_LOG.


## Final single-pick guard and daily audit update — 2026-11-17
- Final frontend guard requires target_legs=1 to use coupon_type MAIN. The first attempt's TypeScript scope error was caught by CI and fixed; final commit a5eb5db passed all checks and production smoke.
- Daily 08:15 audit now explicitly verifies separate MAIN single (one leg, EUR 4, immediate stake transaction) and 3-leg AKO (three distinct matches, EUR 4), one stake/one return, unique match constraint and pre-aggregated ledger checks.


## Results-sync v72 monitoring — 2026-11-17
Fourth production sample: HTTP 200 in 3.249s, no errors, 7 coupon reconciliations with 0 failures. 3 alternate result observations persisted, no current due result settled. Continue 24h p50/p95 monitoring.

## Bieżące priorytety — 2026-11-17 (aktualizacja 10:01 Europe/Brussels)
1. Zweryfikować skan 15:00 Europe/Brussels na Edge Functions footynomad-sync v87, moneyball-free-feed v43 i moneyball-public-sources v63: źródła, eligible matches, predictions, duplikaty, wyniki i brak 5xx.
2. Dokończyć issue #77: 25/55 federacji UEFA nie ma obecnie potwierdzonego źródła lig krajowych tier 1/2. Zbudować katalog per kraj i znaleźć wyłącznie legalne, aktualne, bezkluczowe feedy; nie dopisywać fikcyjnych aliasów.
3. Zalogowane E2E w istniejącej sesji MAIN: scan → prediction → kupon 4 EUR → wynik → ledger → statystyki. Nie prosić o hasło ani nie symulować tożsamości.
4. Brak świeżych kursów belgijskich pozostaje blokadą: MAIN/MEGA/EXTRA nie mogą korzystać ze starych/fair/syntetycznych cen.
5. Monitorować nowe owner-scoped finance RPC po pierwszym rzeczywistym rozliczeniu. Rollback test 10:00 potwierdził stake 4 EUR, odds 3.72, payout 14.88, idempotencję, cancel refund 4 EUR i rollback bez rekordów testowych.
6. Pozostałe full-table reads ograniczyć do Bankroll i saveCouponBatch; obecnie 9 transakcji, 9 kuponów, saldo 84.28 EUR. Nie zmieniać bez potrzeby.
7. Zachować historyczny 5 EUR TEST kupon jako incomplete bez kursów; nie wymyślać wypłaty.
8. Nie zamykać #77 i nie deklarować całego projektu jako ukończonego. Bez Vercel/TEST.
## Naprawy po audycie 08:15 — 2026-11-17
Auth 401 źródeł publicznych naprawiony (moneyball-predict v245); ręczna paginacja po eligibility naprawiona (v246 + owner-scoped RPC); shared eligibility odrzuca nazwane hiszpańskie rezerwy i NB III+; finanse nie liczą kuponów ze stawką 0 jako niekompletnych. Szczegóły, migracje, commit SHAs, testy i metryki są w PROJECT_STATE oraz PROJECT_MEMORY_AND_REGRESSION_LOG. Najnowszy CI/deploy commit e82719ed — oba SUCCESS. Panel zalogowany nadal wymaga testu w sesji użytkownika.

## Statistics RPC deployed — 2026-11-17 08:38 UTC
Statystyki korzystają z jednego owner-scoped RPC moneyball_statistics_page_data(). Finalny payload testowy: 374 mecze kwalifikowane, 1,321 aktywnych prognoz, 1 kupon/3 nogi, 798,520 B. Zwraca stored stake/P&L, rationale i zweryfikowane wyniki; pomija duże notes/data_coverage. CI 44048281991 i Cloudflare 44048281920 SUCCESS. Pozostałe ryzyka: brak świeżych kursów, otwarty #77, brak zalogowanego E2E, jedna historyczna wygrana 5 EUR bez kursów.

## Financial RPC and odds-source audit — 2026-11-17 08:52 UTC
Settlement and cancellation now use owner-scoped atomic RPCs; rollback tests passed for pending→won, idempotent stake/return, cancellation refund and ledger rebuild. Exact 3-leg example 1.100×1.182×1.167 gives combined odds 1.517 and 4 EUR payout 6.07. Latest CI/deploy ee8e6eb1 success. Balance 84.28 EUR. TipsAudit public API was tested (HTTP 200) but provides only partial fair 1X2 references and no eligible domestic tier 1/2 fixtures today; not a usable Belgian bookmaker feed. No compliant no-key/free odds source found; keep real-money coupon categories blocked until fresh odds exist.


## Source coverage and scope regression — 2026-11-17 10:01 UTC
New audit: docs/EUROPEAN_LEAGUE_SOURCE_COVERAGE_2026-11-17.md. Current public catalogues provide at least one tier 1/2 source for 30/55 UEFA associations (28 tier 1, 19 tier 2, 17 both); 25 associations have no verified source. FootyNomad browse/day page is inconsistent. Production SQL accepted 3 false positives in 634 labels (Serie D Championship Round, Damallsvenskan, Premier League Summer Series); code + SQL filters fixed and 12/12 regression cases pass. Supabase Edge Functions v87/v43/v63 deployed; CI 44051320905 and Cloudflare 44051320954 SUCCESS. Next scheduled 15:00 scan and authenticated MAIN UI E2E remain pending. Project not complete.

## Football Charts fallback and remaining source gap — 2026-11-17 10:20 UTC
New provider audit in docs/EUROPEAN_LEAGUE_SOURCE_COVERAGE_2026-11-17.md and docs/FOOTBALL_CHARTS_SOURCE_EVALUATION_2026-11-17.md. Football Charts: 98 leagues / 44 countries, 31 UEFA associations; adds seven countries to previous 30/55 coverage, now at least 37/55; 18 associations remain uncovered. Implemented owner-only no-key eight-league fixture fallback in authenticated footynomad-sync; UTC to Europe/Brussels date filter, attribution, provider model discarded; owner UUID gate for personal-use terms. SQL aliases for efbet League and TOPLYGA; 15/15 SQL tests. CI 44053372684 and Cloudflare MAIN deploy 44053372690 SUCCESS; Supabase footynomad-sync v88. Authenticated import still needs verification at 15:00. FotMob/SofaScore rejected due automated extraction restrictions; TheSportsDB adds no coverage; OpenFootball old files are historical only.


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

## OpenLigaDB / FixtureDownload audit and edge sync — 2026-11-17 10:27 UTC
OpenLigaDB current 2026 season and FixtureDownload catalogue were checked; neither adds verified current domestic coverage among the 18 remaining UEFA associations. OpenLigaDB LaLiga 2026 has valid timestamps; Eredivisie 2026 has null matchDateTime and a 1970 UTC sentinel, do not import; Austrian shortcuts tested empty. Deployed moneyball-free-feed v44 (verify_jwt=true) to apply efbet League/TOPLYGA aliases; footynomad-sync v88 remains active. Authenticated 15:00 scan still pending.

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