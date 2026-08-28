# kObywatel

Aplikacja webowa (PWA) stanowiąca system e-governance dla społeczności Minecraft SMP o nazwie **KibelSMP**. Umożliwia obywatelom składanie wniosków, zgłaszanie problemów, przeglądanie dokumentów i mapy świata gry — również offline, jako zainstalowana aplikacja.

## Funkcje

- **Wyszukiwarka**: Miasta, stacje, linie transportowe i inne treści z całego portalu
- **kHandel**: Katalog produktów i sklepów w świecie gry
- **kWiedza**: Dokumentacja i poradniki w formacie Markdown
- **kSejm**: Uchwały i ustawy z kategoriami, zakresem oraz załącznikami Markdown/PDF, w tym szablony i regulaminy dla posłów
- **kFirma**: Rejestr firm działających w świecie gry oraz formularz rejestracji nowej firmy
- **kDokumenty / kSEF**: Generowanie dokumentów i faktur (PDF) bezpośrednio w przeglądarce
- **Mapa**: Interaktywna mapa z punktami, liniami kolejowymi, edytorem szkiców i trybem offline (pobieranie kafelków mapy)
- **Ustawienia**: Personalizacja kafelków strony głównej, zarządzanie mapą offline
- **Twórcy**: Informacje o zespole deweloperskim

## Technologie

- **Frontend**: Next.js (App Router), React, Tailwind CSS v4
- **Eksport**: statyczny (`output: 'export'`), bez backendu — aplikacja jest hostowana jako pliki statyczne
- **Logika interaktywna**: kluczowe funkcje (mapa, generowanie PDF, wyszukiwarka, obsługa offline) są zaimplementowane jako skrypty vanilla JS ("wyspy") osadzone w stronach Reactowych
- **Markdown**: Renderowanie za pomocą Markdown-it
- **PWA**: instalowalna aplikacja z trybem offline (Service Worker, cache map i kluczowych stron)
- **Dane**: Pobierane w czasie działania z zewnętrznego repozytorium GitHub
- **Hosting**: Vercel

## Rozwój lokalny

```bash
npm install
npm run dev       # serwer deweloperski z hot reload
npm run build     # produkcyjny eksport statyczny do out/ + manifest PWA
npm run serve:out # podgląd zbudowanej wersji produkcyjnej
```

## Zasoby

- **Tekstury Minecraft**: pochodzą z oficjalnych zasobów Minecraft Wiki
- **Ikony**: Google Material Icons (ikony UI) i inne zasoby z Google Fonts
- **Dokumenty**: od ich autorów

## Konfiguracja

Dane są pobierane w czasie działania z zewnętrznego repozytorium skonfigurowanego w `public/db.config.json`.

## Licencja

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) - zobacz plik LICENCE.

Dedykowane dla graczy KibelSMP.
