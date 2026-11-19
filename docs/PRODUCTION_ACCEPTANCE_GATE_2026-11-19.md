# MONEYBALL GLOBAL REBUILT — produkcyjna bramka odbioru

Data aktualizacji: 2026-11-19

## Zakres i zakazy

- Jedyny zakres prac: repozytorium `damianwalus3-jpg/moneyball-global`, branch `moneyball-rebuild`.
- Docelowa produkcja: `https://moneyball-global-rebuild.damianwalus3.workers.dev/`.
- Nie dotykać branch/środowiska MAIN, starego Workera, Vercel, TEST ani Lovable.
- Nie dodawać płatnych usług ani nie uruchamiać płatnych planów.
- Nie modyfikować historycznych kuponów, rozliczeń, wyników ani zapisów bankrolla bez odrębnego, udokumentowanego powodu i dowodu.
- Projekt pozostaje NIEUKOŃCZONY do zamknięcia wszystkich bramek poniżej.

## Zasada nadrzędna

Zielone testy jednostkowe, TypeScript i build nie dowodzą kompletności rzeczywistego skanu ani poprawności danych w przeglądarce Android. Odbiór wymaga jednoczesnego potwierdzenia kodu, wdrożenia, działania źródeł i rzeczywistego eksportu Trackera.

## Bramka końcowego odbioru

1. **Wdrożenie** — potwierdzić SHA aktualnego HEAD na `moneyball-rebuild`, odpowiadający mu udany workflow deploy, URL produkcyjnego Workera oraz smoke test aktualnego artefaktu. Historyczny udany workflow nie potwierdza automatycznie późniejszego HEAD.
2. **Rzeczywisty skan i pary rynków** — po świeżym skanie porównać listę meczów źródłowych z rekordami Trackera. Każdy fixture z danego skanu musi mieć osobny rekord 1X2 i osobny rekord DOUBLE_CHANCE. Zweryfikować fixtureId, fixtureDate, rynek, status, selection, wektor prawdopodobieństw i powód jawnego odrzucenia. Brak modelu/prawdopodobieństw może być poprawnym jawnym ODRZUCONY tylko wtedy, gdy rekord zawiera konkretny powód; nie wolno liczyć pustego lub uszkodzonego rekordu jako poprawnej prognozy. Sprawdzić też duplikaty, brakujące fixtureId i rekordy z innej daty.
3. **Kursy** — sprawdzić rzeczywiste, aktualne kwotowania Bwin Belgium i pozostałych dostępnych źródeł: dopasowanie meczu, rynek, selekcję, kurs dziesiętny, zawieszenie, czas aktualizacji/pobrania, świeżość i źródło. Nie tworzyć kursów syntetycznych. Nie uznawać samego katalogu bukmacherów, statusu API ani kodu integracji za dowód otrzymania kursów.
4. **Kupony i bankroll** — sprawdzić wyłącznie nowe/aktywne dane: trzy różne mecze w kuponie, brak ponownego użycia fixture między nowymi kuponami, kursy tylko z aktualnych i zgodnych rynków, stawki, rezerwację ekspozycji, rozliczenie i saldo. Zachować saldo otwarcia €91.60 jako historyczny seed; nie dopisywać fikcyjnych transakcji.
5. **Historia i rozliczenia** — wykonać audyt świeżego eksportu JSON/CSV oraz porównać go z historią. Raportować błędne/duplikowane osierocone rekordy i brakujące powiązania. Nie naprawiać wstecz kuponów, wyników, settlementów ani bankrolla bez osobnej analizy i zatwierdzonej, bezpiecznej migracji.
6. **Android** — fizycznie sprawdzić na urządzeniu: wejście, skan, automatyczną analizę, nawigację, kupony, kursy, Tracker, eksport/import i czytelność tabel. Nie deklarować testu Android na podstawie samego builda desktop/web.
7. **Raport i zapis etapu** — zapisać SHA, runy CI/deploy, wyniki smoke testów, datę skanu Europe/Brussels, liczbę fixture/1X2/DC, źródła kursów, stan kuponów/bankrolla, wyniki audytu historii i wynik Android. Otwarta bramka oznacza status NIEUKOŃCZONY.

## Wykonane i zweryfikowane 2026-11-19

### Kod, CI i produkcja

- Branch HEAD po wdrożeniu: `ac822efd589ad87a30356b3d5d9ad9c3c709ad69`.
- CI: run `44476556261` — sukces, TypeScript/build/test; **308 testów w 31 plikach**.
- Deploy: run `44476556051` — sukces; wdrożenie do oddzielnego Cloudflare Worker, smoke test Worker/PitchAPI i pełny source reconciliation zakończone sukcesem.
- Nie dotknięto MAIN, starego Workera, Vercel, TEST ani Lovable.

### Aktualny europejski source reconciliation

Snapshot z `2026-11-19T07:04:06Z`, data Europe/Brussels `2026-11-19`:

- 48 unikalnych fixture, 15 krajów, 27 rozgrywek.
- 9/9 źródeł oznaczonych jako zdrowe; zero błędów źródeł.
- Zero duplikatów canonical keys, zero meczów z błędną datą i zero meczów spoza Europy.
- Świeżość: wiek skanu 0 sekund; katalog OpenMatchday 0,3 h; feed timezoneFootball 4,8 h.
- OpenLigaDB 5 fixture; ESPN 8; FootyNomad 18; Flashscore 21; API-Football 111 surowych fixture, z czego 21 europejskich na wskazaną datę; PitchAPI 8 fixture w dziennym feedzie, 1 europejski.
- PitchAPI katalog: 39 europejskich lig, wszystkie 39 oznaczone jako bezpłatne; 6 609 nadchodzących fixture w katalogu, 1 fixture na ten dzień.
- OpenMatchday i OpenFootball zwróciły 0 fixture na ten dzień, ale bez błędów.
- To jest snapshot pokrycia źródeł na jeden dzień, a nie dowód kompletności wszystkich europejskich lig, poziomów regionalnych, kobiecych i młodzieżowych.
- Diagnostyka statusu API-Football chwilowo zwróciła 429, natomiast osobny feed fixture zwrócił 111 wpisów. Nie uznawać problemu limitowania API-Football za definitywnie rozwiązany.

### OddsPapi — konfiguracja rzeczywista i aktywny przepływ

- Produkcyjny `/api/odds/status` potwierdził: `oddspapi=true`, `strikerapi=true`, `pilotEnabled=true`.
- Odczyt konta OddsPapi: limit 250 zapytań, wykorzystane 0, pozostałe 250 w chwili kontroli.
- Konto udostępnia m.in. feedy: `bwin.be`, `unibet.be`, `betfirst.be`, `bingoal.be`, `goldenpalacesports.be`, `betcenter.be`, `scooore.be`, `starcasino.be`, `napoleonsports.be`, a także wybrane źródła porównawcze, m.in. Pinnacle, bet365, Unibet i Ladbrokes.
- Sekrety pozostają po stronie Cloudflare Worker; endpoint statusu ujawnia wyłącznie obecność konfiguracji, limit i dozwolone slugi bukmacherów.
- Dodano `src/oddspapi.ts`: konwersję lokalnej daty Europe/Brussels do zakresu UTC, dopasowanie po nazwach drużyn i czasie, obsługę rynku 1X2 (market 101, outcomes 101/102/103), kontrolę aktywności bukmachera/rynku/cen i timestampów.
- Dodano chroniony endpoint `POST /api/odds/oddspapi/daily`. Używa istniejącego `ODDSPAPI_API_KEY` oraz `ODDS_PILOT_TOKEN`, sprawdza aktualne saldo zapytań przez `/v4/account`, pobiera dzienną listę fixture i zbiorcze kursy dla rozgrywek, które zostały dopasowane do skanu.
- Jedna synchronizacja zużywa maksymalnie 2 rozliczane zapytania: `/v4/fixtures` i `/v4/odds-by-tournaments`. Endpoint `/account` jest według dokumentacji niepłatny i służy do odczytu limitu. Odpowiedzi są cache'owane.
- Aplikacja ma osobne próby OddsPapi i StrikerAPI, aby wcześniejszy odczyt jednego dostawcy nie blokował drugiego. OddsPapi ma dwa okna synchronizacji — przed i po 15:00 czasu belgijskiego; maksymalnie 4 rozliczane zapytania dziennie, około 120 na 30 dni przy pełnym wykorzystaniu obu okien, wobec obecnego limitu 250.
- Bwin Belgium jest osobnym feedem; pozostałe dostępne feedy .be są używane do porównania. Brak oferty lub zawieszony rynek nie jest traktowany jako kurs.
- Snapshot 1X2 jest oznaczany jako wycenialny wyłącznie wtedy, gdy wszystkie trzy ceny są aktywne, rynek i bukmacher są aktywni, a timestampy wszystkich cen są dostępne. Wiek całego zestawu liczony jest od najstarszej z trzech cen. Nieświeże snapshoty (powyżej 60 minut) nie są używane do EV.
- Dodano test integracyjny Worker: dzienny pakiet OddsPapi, dopasowanie Bwin Belgium i trzy rzeczywiste pola cenowe. Testy jednostkowe całego projektu: 308/308.
- **Ważne ograniczenie odbioru:** potwierdzono konfigurację konta, uprawnienia do bukmacherów, działanie kodu i testy z kontrolowanymi odpowiedziami. Nie potwierdzono jeszcze, że aplikacja Android pobrała i zapisała rzeczywiste kursy dla konkretnych meczów z bieżącego dnia. To wymaga uruchomienia w przeglądarce z lokalnym tokenem i świeżego eksportu Trackera.

### Rozdzielenie prognoz od wyceny kursowej

- `analysis-evidence.ts` wymaga 7 obszarów analizy sportowej. Dostępność kursu i EV została oddzielona jako warstwa wyceny zakładu.
- Brak kursu nie blokuje zapisu prognozy 1X2 ani Double Chance i nie może samodzielnie powodować statusu ODRZUCONY.
- Nadal obowiązują pozostałe warunki jakości danych sportowych, minimalnej próbki i progu kandydata. Brak historii, składów, kontuzji lub innych wymaganych danych może nadal jawnie odrzucić kandydata — nie wolno tego mylić z brakiem kursu.
- Kursy Double Chance nie są syntetyzowane z 1X2. Bez bezpośredniego kursu DC kupon DC pozostaje bez wyceny; nie wolno wyliczać fikcyjnej oferty bukmachera.

### Wstępny audyt wcześniejszego eksportu Trackera

- Dostępny w Library backup `moneyball-backup (2).json` ma `exportedAt=2026-11-18T18:43:02Z`; nie jest świeżym eksportem z bieżącego skanu 2026-11-19.
- 1 086 rekordów: 232 match, 818 prediction, 17 scan, 12 result, 7 coupon; 0 odds, 0 bet i 0 ledger.
- Dla 2026-11-18: 219 rekordów meczów. Prognozy obejmowały 212 fixture: 1X2 było zapisane dla 212/219, ale prawidłowe wektory prawdopodobieństw miało tylko 104/219. Double Chance było zapisane dla 169/219, a prawidłowe wektory miało 61/219. Odpowiednio 7 meczów nie miało żadnego rekordu prognozy, 50 nie miało rekordu DC, a wiele zapisów miało brakujące prawdopodobieństwa i jawny powód odrzucenia.
- Dla 2026-11-17: 13 meczów i 13 prawidłowych rekordów 1X2, ale brak osobnych rekordów DC dla wszystkich 13.
- W starym backupie wykryto 11 par aliasów tego samego meczu z tego samego dnia między różnymi źródłami (Flashscore/FootyNomad). To historyczne zapisy; nie przepisywać ich automatycznie.
- 7 historycznych kuponów miało po 3 różne mecze w każdym kuponie, ale wszystkie były `PAPER_NO_ODDS`, bez kursu, stawki, potencjalnej wypłaty i EV. Łącznie używały tylko 7 unikalnych fixture; 5 fixture powtarzało się między kuponami. Najczęściej powtarzany fixture wystąpił w 7 kuponach.
- 12 wyników było powiązanych z typami 1X2 oznaczonymi `ODRZUCONY`; surowy wybór 1/X/2 trafił 5/12 (41,7%). To nie jest skuteczność wybranych kandydatów ani ROI, ponieważ wszystkie te typy były odrzucone i backup nie zawierał kursów ani stawek.
- Ponieważ backup nie zawiera rekordów zakładów ani ledger, nie można z niego wyliczyć rzeczywistego P/L ani odtworzyć historii salda. Nie dopisywać transakcji na podstawie domysłów.
- Wyniki tego audytu są wyłącznie bazową kontrolą eksportu z 18 listopada. Wymagają ponownego sprawdzenia na świeżym eksporcie Android po obecnym wdrożeniu.

## Otwarte bramki — nie ogłaszać ukończenia

1. **Świeży eksport Android Tracker:** potrzebny do porównania każdego rzeczywistego fixture ze skanu z osobnym rekordem 1X2 i DC, walidacji wektorów prawdopodobieństw, uzasadnień ODRZUCONY, braków i duplikatów.
2. **Rzeczywiste kursy:** po uruchomieniu aplikacji z lokalnie zapisanym tokenem sprawdzić snapshoty OddsPapi/StrikerAPI dla konkretnych meczów, w tym czy Bwin BE faktycznie wystawił aktywną cenę; samo uprawnienie do feedu nie dowodzi dostępności kursu w każdym meczu.
3. **Kupony i bankroll:** zweryfikować aktywne kupony, dokładnie 3 różne fixture, brak ponownego użycia fixture między nowymi kuponami, wycenę, ekspozycję, rozliczenia i saldo na świeżym eksporcie. Nie zmieniać historii.
4. **Historia i rozliczenia:** porównać JSON/CSV z zapisami lokalnymi; nie dopisywać brakujących kursów, stawek, wyników ani wypłat bez dowodu.
5. **Android:** fizyczny test na urządzeniu nie został wykonany. Build i testy automatyczne nie zastępują testu dotyku, nawigacji, tabel i eksportu/importu.
6. **Double Chance pricing:** bezpośredni feed kursów DC nie jest jeszcze zaimplementowany; nie wyceniać kuponów DC przez przybliżenie.
7. **API-Football 429:** monitorować rozbieżność pomiędzy diagnostyką limitu a odpowiedzią feedu; nie wykonywać agresywnych retry.

## Następna kolejność

1. Otworzyć aplikację Android, upewnić się, że lokalny token jest zapisany, wykonać skan i obie synchronizacje kursów.
2. Wyeksportować Tracker JSON i CSV z Androida.
3. Przeprowadzić audyt par 1X2/DC oraz rzeczywistych snapshotów kursów.
4. Przeprowadzić audyt kuponów, bankrolla, historii i rozliczeń.
5. Wykonać fizyczny test interfejsu Android.
6. Dopiero wtedy sporządzić końcowy raport produkcyjny i ewentualnie zamknąć projekt.

**Status projektu: W TRAKCIE — nieukończony.**
