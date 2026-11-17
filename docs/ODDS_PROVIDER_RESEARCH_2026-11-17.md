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
