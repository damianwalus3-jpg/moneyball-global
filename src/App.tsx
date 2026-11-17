import { useState } from "react";
import {
  Activity, BarChart3, Bell, CalendarDays, ChevronRight, CircleDot,
  ClipboardList, Database, Gauge, LayoutDashboard, Menu, Plus, Search,
  ShieldCheck, Sparkles, Ticket, Trophy, X
} from "lucide-react";

type Tab = "dashboard" | "matches" | "pick" | "coupons" | "intelligence" | "tracker";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "matches", label: "Mecze", icon: CalendarDays },
  { id: "pick", label: "Typ dnia", icon: Sparkles },
  { id: "coupons", label: "Kupony", icon: Ticket },
  { id: "intelligence", label: "Intelligence", icon: BarChart3 },
  { id: "tracker", label: "Tracker", icon: ClipboardList },
];

const descriptions: Record<Tab, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: { eyebrow: "CENTRUM DOWODZENIA", title: "Trust the Process.", subtitle: "Przejrzysta analityka. Zweryfikowane dane. Każda decyzja z uzasadnieniem." },
  matches: { eyebrow: "CENTRUM MECZÓW", title: "Mecze", subtitle: "Europejskie rozgrywki, forma drużyn i komplet danych źródłowych." },
  pick: { eyebrow: "SELEKCJA DNIA", title: "Typ dnia", subtitle: "Jedna selekcja oparta na danych — albo uczciwa informacja, że dziś brak przewagi." },
  coupons: { eyebrow: "ZARZĄDZANIE KUPONAMI", title: "Kupony", subtitle: "Buduj, zapisuj i rozliczaj kupony analityczne. Bez obstawiania za prawdziwe pieniądze." },
  intelligence: { eyebrow: "ANALITYKA MODELU", title: "Intelligence", subtitle: "Skuteczność, kalibracja, jakość danych i wyniki według lig oraz rynków." },
  tracker: { eyebrow: "REJESTR GŁÓWNY", title: "Tracker", subtitle: "Jedno miejsce dla skanów, prognoz, kursów, kuponów, wyników i historii." },
};

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Activity }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{note}</small></article>;
}

export default function App() {
  const [active, setActive] = useState<Tab>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = descriptions[active];

  const changeTab = (tab: Tab) => { setActive(tab); setMobileOpen(false); };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={22} /></div><div><b>MONEYBALL</b><span>TRUST THE PROCESS</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Zamknij menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Główna nawigacja">
        {nav.map(item => <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => changeTab(item.id)}><item.icon size={18}/><span>{item.label}</span>{active === item.id && <span className="nav-dot"/>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><ShieldCheck size={17}/><div><b>Transparent by design</b><span>Źródła i historia każdej prognozy</span></div></div>
        <div className="profile"><div className="avatar">MB</div><div><b>MONEYBALL</b><span>Nowy projekt · v0.1</span></div><CircleDot size={15} className="online-dot"/></div>
      </div>
    </aside>

    {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Zamknij menu"/>}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Otwórz menu"><Menu size={21}/></button>
        <div className="breadcrumb"><span>WORKSPACE</span><ChevronRight size={14}/><b>{nav.find(n => n.id === active)?.label}</b></div>
        <div className="top-actions"><span className="timezone"><span className="live-pulse"/> EUROPE / BRUSSELS</span><button className="icon-button" aria-label="Powiadomienia"><Bell size={18}/></button></div>
      </header>

      <div className="content">
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>{current.eyebrow}</div><h1>{current.title}</h1><p>{current.subtitle}</p></div><div className="build-chip"><span/> CLEAN BUILD <b>0.1.0</b></div></section>

        {active === "dashboard" && <>
          <section className="welcome-panel"><div className="welcome-glow"/><div className="welcome-copy"><div className="welcome-tag"><Sparkles size={14}/> NOWY ROZDZIAŁ</div><h2>Najpierw dane.<br/><em>Potem decyzje.</em></h2><p>Nowa platforma analityczna budowana od podstaw. Bez fikcyjnych statystyk i bez ukrywania brakujących informacji.</p><button className="primary-button" onClick={() => changeTab("tracker")}>Otwórz Tracker <ChevronRight size={16}/></button></div><div className="welcome-visual"><div className="orb orb-one"/><div className="orb orb-two"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="visual-center"><Activity size={36}/><span>MB</span></div><div className="visual-label label-top">DATA FIRST</div><div className="visual-label label-bottom">MODEL VERIFIED</div></div></section>
          <div className="section-title"><div><h3>Stan systemu</h3><p>Nowa instalacja — brak zaimportowanych danych</p></div><span className="neutral-tag">INITIALIZING</span></div>
          <section className="metrics-grid"><Metric label="Dzisiejsze mecze" value="—" note="Oczekuje na źródło terminarza" icon={CalendarDays}/><Metric label="Prognozy" value="0" note="Nowy rejestr prognoz" icon={Gauge}/><Metric label="Aktywne kupony" value="0" note="Brak zapisanych kuponów" icon={Ticket}/><Metric label="Tracker" value="READY" note="Moduł w trakcie budowy" icon={Database}/></section>
          <section className="lower-grid"><article className="panel"><div className="panel-heading"><div><h3>Ostatnia aktywność</h3><p>Zdarzenia w nowym systemie</p></div><Activity size={18}/></div><div className="empty-state"><div className="empty-icon"><Activity size={21}/></div><b>To początek historii</b><span>Po uruchomieniu źródeł pojawią się tu skany, prognozy i rozliczenia.</span></div></article><article className="panel"><div className="panel-heading"><div><h3>Etapy uruchomienia</h3><p>Postęp budowy platformy</p></div><Trophy size={18}/></div><div className="check-list"><div className="check-row done"><span>01</span><div><b>Nowy fundament aplikacji</b><small>Utworzono czystą gałąź i strukturę PWA</small></div><i>DONE</i></div><div className="check-row"><span>02</span><div><b>Model danych i Tracker</b><small>Projekt schematu i walidacji</small></div><i>NEXT</i></div><div className="check-row"><span>03</span><div><b>Źródła i silnik prognoz</b><small>Integracje i testy modeli</small></div><i>WAIT</i></div><div className="check-row"><span>04</span><div><b>Bezpieczeństwo i publikacja</b><small>Testy końcowe i wdrożenie</small></div><i>WAIT</i></div></div></article></section>
        </>}

        {active !== "dashboard" && <section className="module-panel">
          <div className="module-icon">{active === "matches" ? <CalendarDays/> : active === "pick" ? <Sparkles/> : active === "coupons" ? <Ticket/> : active === "intelligence" ? <BarChart3/> : <ClipboardList/>}</div>
          <h2>{active === "matches" ? "Centrum meczów" : active === "pick" ? "Selekcja bez zgadywania" : active === "coupons" ? "Kupony analityczne" : active === "intelligence" ? "Pomiar jakości modelu" : "Centralny rejestr danych"}</h2>
          <p>{active === "matches" ? "Terminarz i dane meczowe pojawią się po podłączeniu zweryfikowanych źródeł." : active === "pick" ? "Typ dnia zostanie opublikowany tylko wtedy, gdy dane i model uzasadnią wybór." : active === "coupons" ? "Generator będzie pilnował reguł kuponu, kursów, stawek analitycznych i rozliczeń." : active === "intelligence" ? "Metryki będą liczone na rozliczonych prognozach. Nie pokażemy skuteczności bez próby." : "Tracker stanie się natywnym źródłem prawdy — bez Google Sheets."}</p>
          <div className="module-status"><span className="status-dot"/> MODUŁ ZAPROJEKTOWANY · IMPLEMENTACJA W TOKU</div>
          <div className="module-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={active === "tracker" ? "Szukaj w rejestrze (po uruchomieniu danych)" : "Wyszukaj (po podłączeniu źródeł)"} disabled/><button disabled><Plus size={16}/> Dodaj</button></div>
        </section>}

        <footer className="footer"><span>MONEYBALL — TRUST THE PROCESS</span><span>FRESH BUILD · DATA TRANSPARENCY FIRST</span></footer>
      </div>
    </main>
  </div>;
}
