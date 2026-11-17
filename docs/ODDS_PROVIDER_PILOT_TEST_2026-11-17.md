# MONEYBALL REBUILD — pilot test OddsPapi + StrikerAPI
**Data decyzji:** 2026-11-17  
**Środowisko:** wyłącznie branch `moneyball-rebuild`; Worker `https://moneyball-global-rebuild.damianwalus3.workers.dev/`.  
**Status:** przygotowanie testu; live test wymaga dwóch kluczy API utworzonych przez właściciela konta i zapisanych jako Worker Secrets.

## Cel
Porównać rzeczywiste pokrycie kursów przedmeczowych dla europejskich fixture'ów już pobranych przez aplikację. Nie zakładamy, że którykolwiek dostawca obejmuje wszystkie kraje, poziomy, płeć, wiek lub rozgrywki.

## Klucze i bezpieczeństwo
- OddsPapi: `ODDSPAPI_API_KEY` — klucz przekazywany w parametrze `apiKey`; wyłącznie po stronie Worker.
- StrikerAPI: `STRIKERAPI_API_KEY` — nagłówek `x-api-key`; wyłącznie po stronie Worker.
- Nie wpisywać kluczy do GitHub, plików .env commitowanych do repo, kodu frontendowego, URL logowanych przez przeglądarkę ani czatu.
- Nie tworzyć kont za użytkownika, nie akceptować płatnego planu, nie włączać billing.
- Użytkownik tworzy darmowe konta/klucze u dostawców i dodaje je jako Worker Secrets w Cloudflare dashboard. Klucze nie są potrzebne w GitHub Actions.
- Do czasu ustawienia obu sekretów adaptery pozostają wyłączone; endpoint diagnostyczny nie może ujawniać sekretów ani przekazywać ich klientowi.

## Oficjalne endpointy i budżet
### OddsPapi
- Host: `https://api.oddspapi.io`
- Katalog rozgrywek: `GET /v4/tournaments?sportId=10&apiKey=...`
- Fixtures: `GET /v4/fixtures` z tournamentId/sportId/from/to/statusId.
- Odds: `GET /v4/odds?fixtureId=...&language=en&verbosity=3`; bez `bookmakers` zwraca dostępnych bukmacherów.
- Market 1X2: `marketType=1x2`; zachować wyłącznie aktywne outcomes 1/X/2 i kursy decimal.
- Plan Free: 250 requestów/miesiąc. Każde billable endpoint call liczy się jako 1 request; nawet odpowiedź 4xx/5xx po przetworzeniu może zużyć limit. `/v4/account` jest unmetered; `/v4/historical-odds` free, ale nie zastępuje live pre-match feed.
- Strategia: najpierw jedna próba /account, potem jeden katalog rozgrywek, następnie maksymalnie 5–8 fixture odds calls dla wybranej próbki. Nie skanuj całej Europy tym planem.

### StrikerAPI
- Host: `https://mcp.strikerapi.com`
- REST: `POST /v1/get_odds`, nagłówek `x-api-key`, JSON `{"date":"YYYY-MM-DD","league":"soccer"}` dla próbki dziennej albo `{"game_id":"..."}` dla pojedynczego spotkania.
- Dzienny request kosztuje 10 credits; meczowy 5 credits.
- Free: 500 credits/miesiąc; endpoint get_odds obejmuje wybrane ligi, a nie wszystkie europejskie rozgrywki. Aktualizacje deklarowane co godzinę dla najbliższych 4 dni; brak kursów live.
- Strategia: 1 zapytanie dzienne (10 credits) i do 4 pojedynczych zapytań (20 credits) tylko gdy trzeba sprawdzić dopasowanie lub braki. Nie powtarzać requestów w pętli.

## Próbka porównawcza
Wybrać 5–8 nadchodzących spotkań z rzeczywistego feedu aplikacji, o ile tego dnia istnieją:
- Anglia: Premier League lub Championship
- Hiszpania: La Liga
- Niemcy: Bundesliga
- Włochy: Serie A
- Francja: Ligue 1
- Holandia/Portugalia/Szkocja: po jednym, jeśli są dostępne
- Co najmniej 2 mniej popularne ligi/niższe poziomy z aktualnej listy aplikacji, aby zmierzyć lukę coverage.
Dla każdego spotkania zapisać lokalną datę Europe/Brussels, kickoff UTC, kraj, rozgrywki, home/away, fixture source ID i normalized key. Nie dobierać innego meczu, jeśli provider go nie ma — brak danych jest wynikiem testu.

## Metryki i kryteria
1. **Fixture coverage:** liczba dokładnych dopasowań / liczba spotkań próbki, osobno provider i kraj/rozgrywki.
2. **Odds availability:** dopasowane mecze z kompletnym 1/X/2 / dopasowane mecze.
3. **Bookmaker coverage:** nazwy bookmakerów dokładnie jak w API; odrębnie Bwin, Unibet, bet365, Pinnacle, Betfair, inne. Nie zakładać, że belgijska oferta jest identyczna z globalnym feedem.
4. **Freshness:** observedAt/changedAt/captured_at i sourceUpdatedAt; opóźnienie względem czasu pobrania; oznaczać brak timestampu.
5. **Price quality:** decimal odds > 1.0, aktywny rynek/outcome, wszystkie 3 outcomes, wykrywanie duplikatów; nie konwertować amerykańskich moneylines StrikerAPI na decimal bez jawnego, testowanego przeliczenia.
6. **Matching:** nazwy obu drużyn, data i kickoff (tolerancja max 15 min, z uwzględnieniem strefy), rozgrywki/kraj; niejednoznaczne dopasowanie = unmatched, nigdy nie przypisywać kursu.
7. **Quota efficiency:** rzeczywiste requesty/credits zużyte na poprawne dopasowanie i kompletny 1X2.
8. **Provider errors:** HTTP status, kategoria błędu, bez zapisywania nagłówków autoryzacji, URL zawierających klucz lub pełnych sekretów.

Wynik nie jest akceptowany jako produkcyjny feed, jeśli fixture matching nie jest jednoznaczny, brakuje timestampów/freshness, 1X2 jest niekompletny albo quota cost nie pozwala na sensowny harmonogram.

## Oczekiwane artefakty testu
- Raport per fixture/provider z matched/unmatched, 1X2 availability, bookmaker list, timestamp, request cost.
- Podsumowanie coverage per country/league i osobny wiersz dla braków.
- Zrzut odpowiedzi zanonimizowany: bez API key, auth header, konta użytkownika.
- Testy jednostkowe parserów i dopasowania z fixture'ami syntetycznymi.
- Brak zapisu kursów testowych do realnego Tracker/P&L; testowe snapshoty mają status `provider-pilot` i nie wpływają na stawki/rozliczenia.
- Decyzja po teście: (A) integracja obu, (B) tylko lepszy provider, (C) odrzucenie obu. Żadnego automatycznego płatnego upgrade.

## Zasada wdrożenia
Najpierw test endpointów i parserów, następnie raport coverage. Dopiero po akceptacji wyników można dodać provider adapter do Worker i UI. Nigdy nie wystawiać kluczy przez frontend/publiczne endpointy.