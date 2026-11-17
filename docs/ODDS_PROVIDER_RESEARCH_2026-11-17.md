# MONEYBALL REBUILD — research kursów bukmacherskich
**Data:** 2026-11-17  
**Zakres:** wyłącznie branch `moneyball-rebuild`; bez zmian w `main`.  
**Cel:** automatyczne pobieranie kursów przedmeczowych do istniejących europejskich fixture'ów, zapis historii kursów i późniejsze porównanie wybranych/odrzuconych typów.

## Wniosek wykonawczy
Nie znaleziono wiarygodnego, legalnie udokumentowanego, całkowicie darmowego i niewymagającego klucza API źródła, które gwarantuje szerokie pokrycie wszystkich europejskich lig oraz aktualne kursy wielu bukmacherów. Nie należy zastępować tego scrapingiem stron bukmacherskich bez potwierdzenia warunków licencji/ToS: rozwiązanie byłoby kruche, podatne na blokady i mogłoby naruszać warunki dostawcy.

Najbardziej realna ścieżka bez opłat abonamentowych:
1. **API-Football Free** jako pierwszy kandydat do kontrolowanego pilotażu: oficjalny cennik deklaruje 100 requestów/dzień, a plan wymienia pre-match i in-play odds; dokumentacja podaje, że pre-match odds są aktualizowane co ok. 3 godziny, dostępne 1–14 dni przed meczem, z 7-dniową historią. Wymaga klucza API i nie gwarantuje kursów dla każdego meczu/ligi/bukmachera. Nie może być opisany jako pełne pokrycie Europy.
2. **APIfootball.com Free** jako alternatywa do porównania: oficjalna strona deklaruje 180 requestów/godzinę/endpoint, kursy 1X2/BTTS/O-U/AH i 65+ bukmacherów, ale bezpłatne pokrycie meczów jest ograniczone do English Championship i French Ligue 2. Wymaga klucza API. To nie rozwiązuje globalnego zakresu.
3. **The Odds API**: darmowy plan ma 500 kredytów/miesiąc, ale wymaga klucza; liczba kredytów może być niewystarczająca dla codziennego skanu wszystkich europejskich spotkań.
4. **Odds-API.io**: strona podaje, że nowe darmowe klucze są obecnie wstrzymane; istniejące klucze mają 500 requestów/dzień i 2 bukmacherów. Nie jest to dostępna ścieżka dla nowego konta.
5. **Sportmonks**: bezpłatny plan obejmuje tylko Danish Superliga i Scottish Premiership; pakiet Odds & Predictions jest płatnym dodatkiem. Nie nadaje się jako darmowy feed całej Europy.
6. **football-data.org**: darmowy pakiet nie zawiera kursów; Odds Add-On jest płatny i obejmuje 40 rozgrywek.
7. **Betfair Exchange API**: opóźniony klucz do developmentu jest dostępny bezpłatnie dla kwalifikujących się użytkowników, ale dostęp do danych live i warunki licencji/KYC są odrębnym procesem; to nie jest darmowy feed kursów bukmacherów dla całej Europy.
8. **OddsPortal scraper na GitHub**: znaleziony projekt open-source dotyczy głównie historycznych kursów otwarcia/zamknięcia i używa Playwright; nie jest zweryfikowanym stabilnym live API ani zgodą na komercyjne ponowne publikowanie danych. Nie wdrażać do produkcji bez analizy warunków serwisu i licencji.

## Porównanie i ograniczenia
| Dostawca | Darmowy dostęp | Kursy | Pokrycie/ograniczenie | Wniosek |
|---|---|---|---|---|
| API-Football | 100 req/dzień, klucz | pre-match + live | zależne od ligi/meczu/bukmachera; pre-match update ~3h; historia 7 dni | najlepszy kandydat na ograniczony pilot |
| APIfootball.com | 180 req/h/endpoint, klucz | 1X2, BTTS, O/U, AH | free tylko Championship + Ligue 2 | dobry test techniczny, słabe pokrycie |
| The Odds API | 500 kredytów/miesiąc, klucz | odds markets | budżet kredytów ograniczony | potencjalny fallback tylko dla wybranych lig |
| Odds-API.io | nowe darmowe klucze wstrzymane | odds | istniejące konta: 2 recreational books, 500/dzień | niedostępne jako nowy darmowy provider |
| Sportmonks | 2 ligi, token | kursy jako dodatkowy pakiet | Danish Superliga + Scottish Premiership free; odds bundle płatny | nie dla pełnego skanu |
| football-data.org | bezpłatne dane podstawowe | Odds Add-On | płatny dodatek, 40 competitions | odrzucić jako free odds source |
| Betfair Exchange | delayed key po kwalifikacji | exchange prices | KYC, osobne uprawnienia live/licencja | ewentualny osobny adapter |
| OddsPortal scraper | kod publiczny | głównie historyczne | scraping/ToS i brak gwarancji live | nie wdrażać bez zgody/licencji |

## Rekomendowana architektura integracji
- Kursy pobierać wyłącznie po stronie Cloudflare Worker, nigdy z przeglądarki; klucz przechowywać jako Worker Secret (np. `API_FOOTBALL_KEY`), nigdy w repo, frontendzie ani logach.
- Dodać adapter dostawcy o wspólnym schemacie: provider, providerEventId, fixtureId, bookmaker, market, outcome, decimalOdds, observedAt, sourceUpdatedAt, isLive, rawHash.
- Dopasowanie zdarzeń musi być konserwatywne: data/czas, znormalizowane nazwy obu drużyn, rozgrywki; jeśli dopasowanie nie jest jednoznaczne, zapisać status unmatched i nie podłączać kursu.
- Przechowywać append-only snapshots; nie nadpisywać historii. Deduplikować identyczne wartości, ale zachować timestampy istotnych zmian.
- W pierwszym etapie pobierać tylko 1X2 dla nadchodzących meczów i odświeżać zgodnie z limitem dostawcy; nie odpytwać per mecz, jeżeli endpoint pozwala pobrać kursy zbiorczo.
- Dodać freshness label (aktualny / opóźniony / brak), nazwę bukmachera, czas aktualizacji i źródło; nigdy nie pokazywać starego kursu jako live.
- Fallback: brak kursu = jawny brak danych, nigdy kurs z innego meczu lub wymyślona średnia.
- Wykorzystać istniejący Tracker `odds` kind, ale rozważyć indeksowanie/retencję snapshotów, bo localStorage ma ograniczenia. Dla synchronizacji urządzeń potrzebna byłaby osobna trwała baza — obecny rebuild jej nie ma.
- Ograniczyć pobieranie do europejskich spotkań z obecnej listy dnia i do lig faktycznie obsługiwanych przez provider. Zachować możliwość oznaczenia brakującego coverage.

## Decyzja i blokada
Nie wdrożono jeszcze pobierania kursów ani nie dodano żadnego sekretu/klucza. Integracja wymaga wyboru dostawcy i jego klucza; użytkownik wcześniej preferował rozwiązanie bez API keys, dlatego nie wolno po cichu wprowadzać takiej zależności. Najlepsza techniczna rekomendacja do pilotażu: API-Football Free, ale dopiero po świadomym udostępnieniu klucza jako Worker Secret i sprawdzeniu realnego coverage wybranych lig. Jeśli klucz jest niedopuszczalny, nie ma obecnie potwierdzonej, stabilnej, szerokiej alternatywy zero-key/free.

## Źródła
- API-Football pricing: https://www.api-football.com/pricing/
- API-Football odds documentation: https://www.api-football.com/documentation-v3
- API-Football coverage: https://www.api-football.com/coverage/
- APIfootball.com pricing/features: https://www.apifootball.com/
- The Odds API pricing: https://the-odds-api.com/
- Odds-API.io free tier status: https://odds-api.io/pricing/free
- Sportmonks free plan: https://www.sportmonks.com/football-api/free-plan/
- Sportmonks pricing: https://www.sportmonks.com/football-api/plans-pricing/
- football-data.org pricing: https://www.football-data.org/pricing
- Betfair developer costs: https://support.developer.betfair.com/hc/en-us/articles/115003864531-Are-there-any-costs-associated-with-API-access
- Betfair licence requirements: https://support.developer.betfair.com/hc/en-us/articles/360002464152-Which-API-Licence-Do-I-Require
- OddsPortal scraper (historical): https://github.com/Bedbin17/oddsportal_scraper

## 2026-11-17 — szerokie rozszerzenie badań: fora, GitHub, agregatory i API keyless

### Nowe, istotne odkrycia
1. **OddsPapi — nowy mocny kandydat do pilotażu.** Oficjalna strona pokazuje Free: 250 requestów/miesiąc, pre-game REST, wszystkie sporty/bukmacherzy i historię; WebSocket jest w ofercie B2B/płatnej. API wymaga darmowego klucza. Dostawca sam zastrzega, że nie gwarantuje kursów dla każdego meczu/bukmachera. Jego blog podaje 300+ bookmakerów i jeden request na pełny board meczu. Są to twierdzenia dostawcy, nie niezależny test pokrycia europejskich lig. Źródła: https://oddspapi.io/en ; https://oddspapi.io/blog/free-sports-data-api/ ; https://oddspapi.io/blog/historical-odds-api/ ; https://oddspapi.io/blog/odds-api-pricing-2026-comparison/
2. **StrikerAPI — drugi kandydat do pilotażu.** Oficjalna dokumentacja: 500 kredytów/miesiąc, endpoint get_odds kosztuje 5 kredytów dla meczu lub 10 dla dnia; kursy odświeżane co godzinę dla meczów w najbliższych 4 dniach, bez feedu live. Zakres obejmuje określone ligi (m.in. EPL, La Liga, Serie A, Bundesliga, Ligue 1, Championship, Eredivisie, Primeira, UCL/UEL/UECL, Scotland i wybrane poza Europą). Daily feed może mieć tylko 1–2 bukmacherów na mecz; głębsze archiwum obejmuje 16 rozgrywek, nie całą Europę. Klucz wymagany. Źródła: https://strikerapi.com/ ; https://strikerapi.com/docs/get-odds ; https://strikerapi.com/docs/atlas
3. **FootballAPIs.com** to katalog/porównywarka 17 providerów i publiczny MCP do wyszukiwania dostawców, nie samodzielny kursowy feed. Może służyć do dalszego odkrywania źródeł i monitorowania zmian. https://footballapis.com/ ; https://footballapis.com/compare/ ; https://footballapis.com/api/
4. **Polymarket Gamma API** jest publiczne, bez klucza, i daje eventy/rynki/ceny dla części meczów piłkarskich. To rynek predykcyjny/exchange, nie bukmacherski kurs 1X2; dostępność i płynność są ograniczone, a bid/ask/spread ma znaczenie. Może być osobnym benchmarkiem tylko tam, gdzie istnieje właściwy event i wystarczająca płynność. https://docs.polymarket.com/developers/gamma-markets-api/overview ; https://institute.polymarket.com/data
5. **football-data.co.uk** — bieżąca strona pokazuje pliki sezonowe i kursy opening/closing, ale zastrzega użycie dla prywatnych osób, nie dla komercyjnych produktów, automatycznych botów/scraperów/AI training. Nie wdrażać bez zgody/licencji. Strona ostrzega też o nieaktualnych kursach Pinnacle po 23.07.2025. https://www.football-data.co.uk/data.php ; https://www.football-data.co.uk/downloadm.php
6. **OddsHarvester** — dojrzały projekt open source (MIT, ok. 273 stars / 58 forks w wynikach badania), Playwright, upcoming/historic/live, ponad 100 lig, 11 sportów, JSON/CSV/S3. Jednak źródłem jest OddsPortal. Regulamin OddsPortal wprost zakazuje automatycznych żądań, scrapingu/agregacji i udostępniania istotnej części bazy bez zgody. MIT dotyczy kodu scraper'a, nie praw do danych OddsPortal. Nie używać w produkcji bez pisemnej zgody. Repo: https://github.com/jordantete/OddsHarvester ; ToS: https://www.oddsportal.com/terms/
7. **BetExplorer** — regulamin również zakazuje automatycznych żądań oraz scrapingu/agregowania treści bez wyraźnej zgody. Odrzucić jako nieautoryzowany feed. https://www.betexplorer.com/terms-of-service.php
8. **Społecznościowe tropy Reddit/r/algobetting**: użytkownicy wskazują, że ukryte XHR/JSON endpointy bywają łatwiejsze niż HTML, ale zmieniają się, wymagają czasem weryfikacji i grożą blokadami; relacje wskazują regionalizację bookmakerów i znikające kursy (np. Bwin/Unibet zależnie od kraju/IP). To obserwacje użytkowników, nie potwierdzone API ani zgoda na użycie. Źródła: https://www.reddit.com/r/algobetting/comments/1bky53f/ ; https://www.reddit.com/r/algobetting/comments/1mfijyi/ ; https://www.reddit.com/r/algobetting/comments/1mub2r6/ ; https://www.reddit.com/r/algobetting/comments/1sz5ycy/
9. **Problemy OddsPortal**: szyfrowane payloady, wydłużony czas pobrania 6–10 sekund na stronę, regionalne przekierowania i blokady. Reddit: https://www.reddit.com/r/algobetting/comments/1h55lna/ ; https://www.reddit.com/r/algobetting/comments/1jufa65/

### Porównanie nowych opcji
| Źródło | Bez klucza? | Darmowy limit | Zakres | Aktualność | Ocena |
|---|---|---:|---|---|---|
| OddsPapi | Nie | 250 requestów/miesiąc | 300+ bookmakerów deklarowane; realne ligi/mecze do testu | pre-game REST; WebSocket płatny | Najlepszy kandydat na pierwszy test coverage |
| StrikerAPI | Nie | 500 credits/miesiąc; get_odds 10 credits/dzień | wybrane ligi europejskie | co godzinę, next 4 days; brak live | Uzupełnienie/benchmark, nie pełna Europa |
| Polymarket Gamma | Tak | publiczny endpoint | tylko wydarzenia z aktywnymi rynkami | ceny rynku aktualne, bid/ask i płynność | Alternatywny benchmark, nie bookmaker |
| football-data.co.uk | Tak | darmowe pliki | ~22 dywizje / 11 krajów w bieżącym pliku; historycznie więcej | okresowe pliki; nie live | Bez zgody nie do produkcji |
| OddsHarvester/OddsPortal | Nie wymaga API key | kod open source, koszt utrzymania | 100+ lig wg README | scraping stron | Bez zgody OddsPortal nie do produkcji |
| BetExplorer scraping | — | — | wiele lig | niestabilne | Odrzucić — ToS zabrania |
| FootballAPIs.com | Katalog bez klucza | publiczny katalog/MCP | 17 providerów porównanych | aktualizacje katalogu | Discovery, nie kursy |

### Co wynika z forów — rzeczywisty problem
- Samo znalezienie endpointu JSON nie rozwiązuje prawa do danych, regionalnego widoku, blokad Cloudflare, limitów ani ciągłego utrzymania parsera.
- Scraping każdego bukmachera jest kosztowny w utrzymaniu; użytkownicy zgłaszają zmiany HTML, endpointów i blokady IP.
- OddsPortal pokazuje różne listy bookmakerów w zależności od regionu/IP; dla Belgii może to oznaczać, że źródło nie prezentuje tego samego co lokalny Bwin/Unibet.
- Nie wolno rotować proxy/VPN w celu obchodzenia zabezpieczeń. Wybieramy oficjalne API, licencjonowany feed albo źródło z jasną zgodą.

### Nowy wniosek i rekomendowana kolejność testów
A. Najpierw **OddsPapi Free** — sprawdzić darmowe konto i testowo pobrać 5–10 europejskich fixture'ów z różnych krajów, sprawdzić bookmaker list, 1X2, hasOdds, timestamp, freshness, API limits i realną dostępność. Uwaga: 250 requestów/miesiąc nie wystarczy na codzienne pobieranie kursów dla setek meczów.
B. Równolegle **StrikerAPI Free** — użyć get_odds(date) dla jednego dnia (10 credits), zmierzyć, czy wynik obejmuje wszystkie wspierane mecze danego dnia, i porównać wspólne fixture'y z OddsPapi. 500 credits/miesiąc to ok. 50 zapytań dziennych po 10 credits.
C. **Polymarket** tylko jako osobny typ rynku i osobna kolumna, nigdy nie mieszać z kursami bukmacherów.
D. Nie podłączać OddsPortal/BetExplorer/football-data.co.uk do produkcji bez zgody na automatyczne pobieranie i dalsze użycie danych.
E. Nie dodawać żadnego klucza do GitHub ani frontendowego kodu. Klucz (jeśli użytkownik wyrazi zgodę) tylko jako Cloudflare Worker Secret.

### Ograniczenia wiarygodności badania
- Nie istnieje możliwość dosłownego przeszukania całego Internetu ani wszystkich prywatnych forów. Przeszukano publicznie indeksowane źródła, dokumentacje dostawców, GitHub, publiczne wątki Reddit/r/algobetting i porównywarki.
- Dane o limitach i coverage OddsPapi są częściowo deklaracjami dostawcy; należy potwierdzić przez live test konta i sprawdzenie odpowiedzi API.
- Nie wykonano jeszcze zapytań z kontem/kluczem użytkownika; nie pobrano realnego kursu do produkcji.
