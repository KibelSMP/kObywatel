# Dokumentacja algorytmów generowania kodów KESEL i KNIP

## **1. Algorytm generowania numeru KESEL**

### **1.1. Podstawa danych wejściowych**

Numer KESEL (_Kiblowy Elektroniczny System Ewidencji Ludności_) generowany jest na podstawie unikalnego identyfikatora UUID (ang. _Universally Unique Identifier_). Identyfikator ten powinien być podany w pełnej formie, obejmującej 32 znaki w systemie szesnastkowym, oddzielone myślnikami.

### **1.2. Proces normalizacji**

1. Ze wskazanego identyfikatora usuwane są wszystkie znaki myślników.

2. Następnie wszystkie litery konwertowane są do formy wielkich liter.

3. Weryfikowana jest długość – oczekiwany wynik to dokładnie 32 znaki. W przypadku niespełnienia tego warunku procedura zostaje przerwana i zgłaszany jest błąd nieprawidłowego UUID.

### **1.3. Konwersja znaków**

Znaki identyfikatora są interpretowane według następujących zasad:

-   cyfry od 0 do 9 pozostają niezmienione,

-   litery szesnastkowe od A do F podlegają przekształceniu na cyfry według schematu:

    -   A → 1
    -   B → 2
    -   C → 3
    -   D → 4
    -   E → 5
    -   F → 6

### **1.4. Wybór pozycji**

Z przekształconego ciągu znaków wybierane są wartości znajdujące się na określonych pozycjach (licząc od początku, tj. od pozycji 1). Są to: 1, 5, 7, 2, 12, 3 oraz 9\.

### **1.5. Obliczenie cyfry kontrolnej**

1. Wybrane znaki zostają zamienione na odpowiadające im cyfry dziesiętne.

2. Następnie obliczana jest suma wszystkich tych cyfr.

3. Cyfra kontrolna ustalana jest jako reszta z dzielenia tej sumy przez 10 (modulo 10).

### **1.6. Konstrukcja numeru KESEL**

Numer KESEL stanowi ośmiocyfrowy ciąg złożony z:

-   siedmiu cyfr uzyskanych w wyniku ekstrakcji i konwersji,

-   jednej cyfry kontrolnej, dodanej na końcu.

---

## **2. Algorytm generowania numeru KNIP**

### **2.1. Ogólna struktura**

Numer KNIP (Kiblowy Numer Identyfikacji Podatkowej) przyjmuje postać:

**DDddMMyyXXV**

gdzie poszczególne fragmenty oznaczają:

-   **DD** – dwie pierwsze cyfry roku,

-   **dd** – dzień miesiąca (w formacie dwucyfrowym),

-   **MM** – numer miesiąca (w formacie dwucyfrowym),

-   **yy** – dwie ostatnie cyfry roku,

-   **XX** – numer kolejny nadawany w ramach danego dnia,

-   **V** – cyfra walidacyjna.

### **2.2. Generowanie numeru kolejnego**

Element **XX** stanowi dwucyfrowy identyfikator kolejności, przypisany do rekordu tworzonego w danym dniu kalendarzowym. Numer ten powinien być nadawany sekwencyjnie, począwszy od wartości „01”.

### **2.3. Obliczanie cyfry walidacyjnej**

1. Wszystkie poprzedzające elementy ciągu, tj. **DDddMMyyXX**, traktowane są jako zbiór cyfr dziesiętnych.

2. Sumowane są wartości wszystkich cyfr.

3. Cyfra walidacyjna (**V**) ustalana jest jako reszta z dzielenia otrzymanej sumy przez 10 (modulo 10).

### **2.4. Finalny numer KNIP**

Końcowy numer KNIP stanowi połączenie wskazanych elementów w ustalonej kolejności, tj. **DDddMMyyXXV**.

---

## **3. Uwagi końcowe**

1. Zarówno KESEL, jak i KNIP stanowią numery identyfikacyjne generowane na podstawie algorytmów deterministycznych.

2. W przypadku KESEL kluczowe znaczenie ma integralność UUID, którego nieprawidłowa długość lub struktura skutkuje odrzuceniem operacji.

3. W przypadku KNIP zasadnicze znaczenie ma poprawne przypisanie numeru kolejnego oraz prawidłowe wyliczenie cyfry walidacyjnej.
