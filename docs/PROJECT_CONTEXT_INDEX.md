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
