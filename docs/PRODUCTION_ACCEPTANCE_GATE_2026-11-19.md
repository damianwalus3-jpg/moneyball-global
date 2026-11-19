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

## Stan ustalony podczas przeglądu 2026-11-19

- Wcześniejszy workflow deploy `44471230239` i workflow CI `44471230330` zakończyły się sukcesem dla ówczesnego kodu. Nie traktować ich jako dowodu wdrożenia późniejszego commitu bez zgodności SHA.
- Poprzedni audyt produkcyjnego skanu: 45 unikalnych meczów, 15 krajów, 25 rozgrywek, 8/9 źródeł zdrowych, zero wykrytych duplikatów kanonicznych, błędnych dat i meczów spoza Europy. API-Football zwrócił 429 mimo diagnostyki wskazującej aktywny plan Pro i pozostały limit; problem pozostaje otwarty. Ten snapshot nie dowodzi kompletności wszystkich europejskich lig i poziomów.
- `src/App.tsx` używa obecnie ścieżki Cloudflare `/api/odds/pilot` ze StrikerAPI; ekran opisuje ograniczenia pokrycia. Nie znaleziono wywołania nowej funkcji OddsPapi z aktywnego interfejsu.
- Commit `064d0519f242b7ed4ed549ad9cde0b22dd91b322` dodaje OddsPapi/Bwin do `supabase/functions/moneyball-movi-odds-sync/index.ts` i wymaga sekretu `ODDSPAPI_API_KEY`. Sam kod tej funkcji nie dowodzi, że jest wdrożona, skonfigurowana ani podłączona do produkcyjnego Cloudflare Workera. Nie wdrażać jej do Supabase ani nie zmieniać architektury bez potwierdzenia, że jest to istniejąca, dozwolona część aktualnej produkcji.
- `src/odds-value.ts` wycenia obecnie kompletne snapshoty 1X2. Kupon zawierający Double Chance nie otrzymuje wyceny, jeśli brak jawnej obsługi kursów DC; interfejs ma to komunikować, a nie zgadywać.
- Tracker jest przechowywany w localStorage konkretnej przeglądarki. Do rzeczywistego audytu wymagany jest świeży eksport z Androida; dane z innego urządzenia nie zastępują tego eksportu.
- `src/market-coverage.ts` sprawdza obecność rekordów rynków, a UI dodatkowo liczy fixture z prawidłowymi wektorami prawdopodobieństw. Testy tej funkcji nie zastępują kontroli rzeczywistego eksportu.

## Kolejność dalszych prac

1. Ustalić rzeczywisty HEAD i mapowanie: commit → CI → deploy → produkcyjny Worker.
2. Zamknąć integrację kursów w aktywnej architekturze Cloudflare albo jawnie wykazać, że dostawca nie jest skonfigurowany; nie uznawać niepodłączonej funkcji Supabase za działającą.
3. Wykonać rzeczywisty skan i audyt par 1X2/DC, w tym jawnych odrzuceń i jakości prawdopodobieństw.
4. Zweryfikować kupony, bankroll i historię na danych eksportowych.
5. Wykonać test Android po otrzymaniu świeżego eksportu i fizycznej kontroli urządzenia.
6. Opublikować końcowy raport dopiero po zamknięciu wszystkich bramek.
