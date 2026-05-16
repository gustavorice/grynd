"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  CircleSlash,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Globe2,
  Instagram,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Plan, PlanId } from "@/lib/plans";
import type { CompanyProfile } from "@/lib/profile";
import type { QuotaSnapshot } from "@/lib/quota";
import type { CompanySize, Lead, LeadStatus, SearchResponse } from "@/lib/types";

type Me = {
  user: { id: string; email: string; fullName: string | null; imageUrl: string | null; plan: PlanId };
  plan: Plan;
  quota: QuotaSnapshot;
};

type ViewMode = "search" | "saved" | "settings";
type SettingsTab = "profile" | "ignored";
type SizeFilter = "all" | CompanySize;
type DataFilter = "all" | "whatsapp" | "social" | "site";
type StatusFilter = "all" | "saved" | "sent" | "contacted";

const MAX_LEADS = 180;

const sizeLabels: Record<CompanySize, string> = {
  pequena: "Pequena",
  media: "Media",
  grande: "Grande"
};

const DEFAULT_PROFILE: CompanyProfile = {
  brandName: "Grynd",
  offer: "Sites, automacoes e presenca digital para negocios locais",
  focusRegion: "Rio Claro e cidades proximas",
  tone: "Curto, consultivo e direto",
  signature: ""
};

export default function Home() {
  const [location, setLocation] = useState("Rio Claro, Sao Paulo, Brazil");
  const [niche, setNiche] = useState("sorveteria");
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [savedLeads, setSavedLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [view, setView] = useState<ViewMode>("search");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");
  const [dataFilter, setDataFilter] = useState<DataFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("Digite um nicho e busque o maximo de leads disponivel.");
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<CompanyProfile>(DEFAULT_PROFILE);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    void loadSavedLeads();
    void loadProfile();
    void bootstrapAndSync();
  }, []);

  async function loadMe() {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      if (data.user) setMe(data);
    } catch {
      // sem auth no dev — mantém null
    }
  }

  /**
   * 1) Se vier de ?billing=success ou ?addon=success, sincroniza imediato.
   * 2) Carrega /api/me.
   * 3) Se o user logado ainda é Free, faz UMA tentativa de sync silencioso
   *    como fallback (resgata pagamentos passados onde o webhook não chegou).
   */
  async function bootstrapAndSync() {
    const params = new URLSearchParams(window.location.search);
    const justUpgraded = params.get("billing") === "success";
    const justBoughtAddon = params.get("addon") === "success";

    if (justUpgraded || justBoughtAddon) {
      setNotice(justUpgraded ? "Confirmando upgrade..." : "Confirmando compra do pacote...");
      try {
        await fetch("/api/stripe/sync", { method: "POST" });
      } catch {
        // mesmo se falhar, continua e tenta loadMe
      }
      window.history.replaceState({}, "", "/app");
      setNotice(
        justUpgraded ? "Plano atualizado!" : "Pacote de leads adicionado à sua quota."
      );
    }

    const initial = await loadMeRaw();
    if (initial) setMe(initial);

    // Fallback: se ainda está como Free, tenta sincronizar uma vez (resgata
    // pagamentos onde webhook não chegou e o user não voltou de ?billing=success).
    if (initial?.user.plan === "free" && !sessionStorage.getItem("grynd_synced")) {
      sessionStorage.setItem("grynd_synced", "1");
      try {
        const r = await fetch("/api/stripe/sync", { method: "POST" });
        const data = await r.json();
        if (data?.plan && data.plan !== "free") {
          const updated = await loadMeRaw();
          if (updated) {
            setMe(updated);
            setNotice(`Plano sincronizado: ${updated.plan.name}.`);
          }
        }
      } catch {
        // silencioso
      }
    }
  }

  async function loadMeRaw(): Promise<Me | null> {
    try {
      const response = await fetch("/api/me");
      const data = await response.json();
      if (data.user) return data;
    } catch {
      // sem auth no dev
    }
    return null;
  }

  async function startCheckout(plan: "pro" | "agency") {
    setNotice("Abrindo checkout...");
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan })
    });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else setNotice(data.error ?? "Nao consegui abrir o checkout.");
  }

  async function startAddonCheckout() {
    setNotice("Abrindo checkout do pacote extra...");
    const response = await fetch("/api/stripe/addon", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else setNotice(data.error ?? "Nao consegui abrir o checkout.");
  }

  async function openBillingPortal() {
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else setNotice(data.error ?? "Nao consegui abrir o portal.");
  }

  const savedById = useMemo(() => new Map(savedLeads.map((lead) => [lead.id, lead])), [savedLeads]);

  const baseLeads = useMemo(() => {
    if (view === "saved") return savedLeads.filter((lead) => lead.status !== "ignored");
    return searchResults.map((lead) => savedById.get(lead.id) ?? lead).filter((lead) => lead.status !== "ignored");
  }, [savedById, savedLeads, searchResults, view]);

  const ignoredLeads = useMemo(
    () => savedLeads.filter((lead) => lead.status === "ignored"),
    [savedLeads]
  );

  const filteredLeads = useMemo(() => {
    return baseLeads.filter((lead) => {
      if (sizeFilter !== "all" && lead.companySize !== sizeFilter) return false;
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (dataFilter === "whatsapp" && !(lead.whatsapp || lead.phone)) return false;
      if (dataFilter === "social" && !(lead.instagram || lead.facebook)) return false;
      if (dataFilter === "site" && !lead.website) return false;
      return true;
    });
  }, [baseLeads, dataFilter, sizeFilter, statusFilter]);

  const stats = useMemo(() => {
    const source = view === "saved" ? savedLeads.filter((lead) => lead.status !== "ignored") : searchResults;
    return {
      total: source.length,
      saved: savedLeads.filter((lead) => lead.status !== "ignored").length,
      whatsapp: source.filter((lead) => lead.whatsapp || lead.phone).length,
      social: source.filter((lead) => lead.instagram || lead.facebook).length
    };
  }, [savedLeads, searchResults, view]);

  async function loadSavedLeads() {
    const response = await fetch("/api/leads");
    const data = await response.json();
    setSavedLeads(data.leads ?? []);
  }

  async function loadProfile() {
    try {
      const response = await fetch("/api/profile");
      const data = await response.json();
      if (data.profile) setProfile(data.profile);
    } catch {
      // mantém o default
    }
  }

  async function searchLeads(mode: "fast" | "deep" = "fast", refresh = false) {
    setLoading(true);
    setView("search");
    setNotice(mode === "deep" ? "Busca profunda em andamento..." : "Buscando leads...");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location, niche, limit: MAX_LEADS, enrich: false, refresh, mode })
      });
      const data = (await response.json()) as SearchResponse & { error?: string };
      if (response.status === 402) {
        setNotice(data.error ?? "Limite de leads atingido. Faca upgrade ou compre +200 leads.");
        return;
      }
      if (response.status === 429) {
        setNotice(data.error ?? "Muitas buscas em sequencia. Aguarde alguns segundos.");
        return;
      }
      if (!response.ok) throw new Error(data.error);
      setSearchResults(data.leads);
      setSelected(data.leads[0] ? savedById.get(data.leads[0].id) ?? data.leads[0] : null);
      setSizeFilter("all");
      setDataFilter("all");
      setStatusFilter("all");
      setNotice(`${data.leads.length} leads encontrados. ${data.coverageNote}`);
      void loadMe(); // refresh quota
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Nao consegui concluir a busca.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (me && !me.plan.canExportCsv) {
      setNotice("Exportar CSV esta disponivel a partir do plano Pro. Clique no badge do plano pra fazer upgrade.");
      return;
    }
    if (filteredLeads.length === 0) {
      setNotice("Nenhum lead pra exportar com os filtros atuais.");
      return;
    }
    const blob = buildLeadsCsv(filteredLeads);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${niche}-${location}-${new Date().toISOString().slice(0, 10)}.csv`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice(`${filteredLeads.length} leads exportados pra CSV.`);
  }

  async function saveLead(lead: Lead, statusOverride: LeadStatus = "saved") {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...lead, status: statusOverride, updatedAt: new Date().toISOString() })
    });
    const data = await response.json();
    if (data.lead) {
      upsertLocalSaved(data.lead);
      replaceSearchResult(data.lead);
      setSelected(data.lead);
      setNotice(statusOverride === "ignored" ? "Lead movido para Configuracoes." : "Lead salvo.");
    }
  }

  async function removeSaved(lead: Lead) {
    const response = await fetch("/api/leads", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: lead.id })
    });
    if (!response.ok) {
      setNotice("Nao consegui remover o lead salvo.");
      return;
    }
    setSavedLeads((current) => current.filter((item) => item.id !== lead.id));
    const searchVersion = searchResults.find((item) => item.id === lead.id);
    const nextLead = searchVersion ? { ...searchVersion, status: "new" as LeadStatus } : null;
    if (nextLead) replaceSearchResult(nextLead);
    setSelected(nextLead);
    setNotice("Lead removido dos salvos.");
  }

  async function setLeadStatus(lead: Lead, nextStatus: LeadStatus) {
    await saveLead(lead, nextStatus);
  }

  async function generateInsight(lead: Lead) {
    setNotice(`Gerando insight de ${lead.name}...`);
    const response = await fetch("/api/enrich", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lead })
    });
    const data = await response.json();
    const nextLead = data.lead ?? lead;
    replaceSearchResult(nextLead);
    if (savedById.has(nextLead.id)) upsertLocalSaved(nextLead);
    setSelected(nextLead);
    setInsights((current) => ({ ...current, [nextLead.id]: buildInsight(nextLead) }));
    setNotice("Insight gerado.");
  }

  async function sendLead(lead: Lead) {
    const text = formatWhatsAppLead(lead, profile);
    setNotice("Procurando telefone e abrindo WhatsApp...");
    const response = await fetch("/api/send-whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lead, text })
    });
    const data = await response.json();
    if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    if (response.ok) {
      const sentLead = (data.lead ?? { ...lead, status: "sent" as LeadStatus, updatedAt: new Date().toISOString() }) as Lead;
      upsertLocalSaved(sentLead);
      replaceSearchResult(sentLead);
      setSelected(sentLead);
      setNotice("WhatsApp aberto e lead salvo como enviado.");
    } else {
      setNotice(data.error ?? "Nao encontrei telefone/WhatsApp publico para esse lead.");
    }
  }

  function upsertLocalSaved(nextLead: Lead) {
    setSavedLeads((current) => mergeLeads(current, [nextLead]));
  }

  function replaceSearchResult(nextLead: Lead) {
    setSearchResults((current) => current.map((lead) => (lead.id === nextLead.id ? nextLead : lead)));
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <button className="brandText" type="button" onClick={() => setView("search")}>
          <img className="brandLogo" src="/arko-logo.png" alt="" />
          <span>Grynd</span>
        </button>
        <nav className="navTabs">
          <NavButton active={view === "search"} icon={<Search size={16} />} label="Busca" onClick={() => setView("search")} />
          <NavButton active={view === "saved"} icon={<BookmarkCheck size={16} />} label="Leads salvos" onClick={() => setView("saved")} />
          <NavButton active={view === "settings"} icon={<Settings2 size={16} />} label="Configurações" onClick={() => setView("settings")} />
        </nav>
        <div className="userArea">
          {me && (
            <button
              className={`planBadge plan-${me.plan.id}`}
              onClick={() => (me.plan.id === "free" ? startCheckout("pro") : openBillingPortal())}
              type="button"
              title={me.plan.id === "free" ? "Fazer upgrade" : "Gerenciar assinatura"}
            >
              {me.plan.id !== "free" && <Crown size={13} />}
              <span>{me.plan.name}</span>
              <span className="quotaCounter">
                {me.quota.searchesUsed.toLocaleString("pt-BR")}/{me.quota.searchesIncluded.toLocaleString("pt-BR")}
                {me.quota.addonRemaining > 0 ? ` +${me.quota.addonRemaining.toLocaleString("pt-BR")}` : ""}
              </span>
            </button>
          )}
          <UserButton afterSignOutUrl="/sign-in" signInUrl="/sign-in" />
          <SignOutButton redirectUrl="/sign-in">
            <button className="signOutButton" type="button" title="Sair">
              <LogOut size={15} />
              <span>Sair</span>
            </button>
          </SignOutButton>
        </div>
      </header>

      {view === "settings" ? (
        <SettingsView
          profile={profile}
          onSaveProfile={setProfile}
          setNotice={setNotice}
          ignoredLeads={ignoredLeads}
          onRestoreLead={(lead) => saveLead(lead, "saved")}
          onDeleteLead={removeSaved}
        />
      ) : (
        <section className="dashboardGrid">
          <aside className="searchCard glassPanel">
            <div>
              <span className="sectionLabel">Busca</span>
              <h1>Busca de leads</h1>
            </div>
            <label>
              Local
              <input value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>
            <label>
              Nicho
              <input value={niche} onChange={(event) => setNiche(event.target.value)} />
            </label>
            <button className="primaryButton" disabled={loading} onClick={() => void searchLeads("fast", false)} type="button">
              {loading ? <RefreshCw className="spin" size={17} /> : <Search size={17} />}
              {loading ? "Buscando..." : "Busca rapida"}
            </button>
            <button className="ghostButton" disabled={loading} onClick={() => void searchLeads("deep", false)} type="button" title="Varredura mais ampla (mais lento, mais leads)">
              <Search size={14} />
              Busca profunda
            </button>
            <button className="ghostButton" disabled={loading} onClick={() => void searchLeads("fast", true)} type="button" title="Ignora cache e refaz">
              <RefreshCw size={14} />
              Atualizar
            </button>
            {me?.plan.addonAvailable && me.quota.searchesAvailable <= 50 && (
              <button className="addonButton" onClick={() => void startAddonCheckout()} type="button">
                <Plus size={14} />
                +200 leads por R$ 20
              </button>
            )}
            {me?.plan.id === "free" && (
              <button className="upgradeButton" onClick={() => void startCheckout("pro")} type="button">
                <Crown size={14} />
                Upgrade pra Pro (R$ 59,90)
              </button>
            )}
            <p className="notice">{notice}</p>
            <div className="miniStats">
              <Metric label="Na busca" value={stats.total} />
              <Metric label="Salvos" value={stats.saved} />
              <Metric label="WhatsApp" value={stats.whatsapp} />
              <Metric label="Social" value={stats.social} />
            </div>
          </aside>

          <section className="leadColumn">
            <div className="toolbar glassPanel">
              <div className="toolbarTitle">
                <SlidersHorizontal size={17} />
                Filtros
              </div>
              <div className="filterBlock">
                <span>Porte</span>
                <div className="filterGroup">
                  {(["all", "pequena", "media", "grande"] as SizeFilter[]).map((item) => (
                    <button className={sizeFilter === item ? "activeFilter" : ""} key={item} onClick={() => setSizeFilter(item)} type="button">
                      {item === "all" ? "Todos" : sizeLabels[item]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filterBlock">
                <span>Dados</span>
                <div className="filterGroup">
                  {(["all", "whatsapp", "social", "site"] as DataFilter[]).map((item) => (
                    <button className={dataFilter === item ? "activeFilter" : ""} key={item} onClick={() => setDataFilter(item)} type="button">
                      {dataLabel(item)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="iconFilters">
                <button className={statusFilter === "all" ? "activeIcon" : ""} title="Todos" onClick={() => setStatusFilter("all")} type="button">
                  <Building2 size={16} />
                </button>
                <button className={statusFilter === "saved" ? "activeIcon" : ""} title="Salvos" onClick={() => setStatusFilter("saved")} type="button">
                  <Bookmark size={16} />
                </button>
                <button className={statusFilter === "sent" ? "activeIcon" : ""} title="Enviados" onClick={() => setStatusFilter("sent")} type="button">
                  <Send size={16} />
                </button>
                <button className={statusFilter === "contacted" ? "activeIcon" : ""} title="Contatados" onClick={() => setStatusFilter("contacted")} type="button">
                  <CheckCircle2 size={16} />
                </button>
              </div>
              <button className="exportButton" onClick={exportCsv} type="button" title="Exportar leads filtrados pra CSV">
                <Download size={15} />
                Exportar CSV
              </button>
            </div>

            <div className="leadList glassPanel">
              {filteredLeads.length === 0 ? (
                <div className="emptyState">
                  <strong>Nenhum lead nesta lista</strong>
                  <span>Busque outro nicho ou ajuste os filtros.</span>
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <button className={`leadRow ${selected?.id === lead.id ? "selected" : ""}`} key={lead.id} onClick={() => setSelected(lead)} type="button">
                    <div className="leadMain">
                      <strong>{lead.name}</strong>
                      <span>{lead.category}</span>
                    </div>
                    <div className="leadBadges">
                      <span className={`sizeTag ${lead.companySize}`}>{sizeLabels[lead.companySize]}</span>
                      {(lead.whatsapp || lead.phone) && <Phone size={15} />}
                      {(lead.instagram || lead.facebook) && <Instagram size={15} />}
                      {lead.website && <Globe2 size={15} />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <LeadDetails
            insight={selected ? insights[selected.id] : undefined}
            isSaved={selected ? savedById.has(selected.id) : false}
            lead={selected}
            onContact={(lead) => setLeadStatus(lead, "contacted")}
            onIgnore={(lead) => setLeadStatus(lead, "ignored")}
            onInsight={generateInsight}
            onRemove={removeSaved}
            onSave={(lead) => saveLead(lead)}
            onSend={sendLead}
            view={view}
          />
        </section>
      )}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? "activeNav" : ""} onClick={onClick} type="button">
      {icon}
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LeadDetails({
  lead,
  isSaved,
  insight,
  onContact,
  onIgnore,
  onInsight,
  onRemove,
  onSave,
  onSend,
  view
}: {
  lead: Lead | null;
  isSaved: boolean;
  insight?: string;
  onContact: (lead: Lead) => void;
  onIgnore: (lead: Lead) => void;
  onInsight: (lead: Lead) => void;
  onRemove: (lead: Lead) => void;
  onSave: (lead: Lead) => void;
  onSend: (lead: Lead) => void;
  view: ViewMode;
}) {
  if (!lead) {
    return (
      <aside className="details glassPanel emptyState">
        <strong>Selecione um lead</strong>
        <span>Contato, mapa e insight aparecem aqui.</span>
      </aside>
    );
  }

  return (
    <aside className="details glassPanel">
      <div className="detailsTop">
        <div>
          <span className="sectionLabel">{lead.niche}</span>
          <h2>{lead.name}</h2>
          <p>{lead.category}</p>
        </div>
        <div className="quickActions">
          <button title={isSaved ? "Remover dos salvos" : "Salvar"} onClick={() => (isSaved ? onRemove(lead) : onSave(lead))} type="button">
            {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
          <button title="Marcar como contatado" onClick={() => onContact(lead)} type="button">
            <CheckCircle2 size={17} />
          </button>
          <button title="Ignorar" onClick={() => onIgnore(lead)} type="button">
            <CircleSlash size={17} />
          </button>
        </div>
      </div>

      <div className="scoreLine">
        <span className={`sizePill ${lead.companySize}`}>{sizeLabels[lead.companySize]}</span>
        <span className="scorePill">Nota {lead.score}</span>
      </div>

      <div className="infoStack">
        <Info icon={<MapPin size={17} />} value={lead.address || lead.city} />
        <Info icon={<Phone size={17} />} value={lead.phone} />
        <Info icon={<MessageCircle size={17} />} value={lead.whatsapp} />
        <Info icon={<Instagram size={17} />} value={lead.instagram} href={lead.instagram} />
        <Info icon={<Mail size={17} />} value={lead.email} />
        <Info icon={<Globe2 size={17} />} value={lead.website} href={lead.website} />
      </div>

      <div className="insightBox">
        <div>Insight</div>
        <p>{insight ?? buildInsight(lead)}</p>
      </div>

      <div className="actions">
        <button type="button" onClick={() => onSend(lead)}>
          <Send size={17} />
          WhatsApp
        </button>
        <button type="button" onClick={() => onInsight(lead)}>
          <RefreshCw size={17} />
          Insight
        </button>
        {lead.mapsUrl && (
          <a href={lead.mapsUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={17} />
            Maps
          </a>
        )}
      </div>

    </aside>
  );
}

function Info({ icon, value, href }: { icon: React.ReactNode; value?: string; href?: string }) {
  if (!value) return null;
  const content = (
    <>
      {icon}
      <span>{value}</span>
    </>
  );
  return href ? (
    <a className="info" href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <div className="info">{content}</div>
  );
}

function SettingsView({
  profile,
  onSaveProfile,
  setNotice,
  ignoredLeads,
  onRestoreLead,
  onDeleteLead
}: {
  profile: CompanyProfile;
  onSaveProfile: (profile: CompanyProfile) => void;
  setNotice: (notice: string) => void;
  ignoredLeads: Lead[];
  onRestoreLead: (lead: Lead) => void;
  onDeleteLead: (lead: Lead) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("profile");

  return (
    <section className="settingsLayout">
      <aside className="settingsSidebar glassPanel">
        <span className="sectionLabel">Configurações</span>
        <h2>Conta</h2>
        <nav className="settingsNav">
          <button
            type="button"
            className={tab === "profile" ? "is-active" : ""}
            onClick={() => setTab("profile")}
          >
            <UserRound size={16} />
            Perfil da empresa
          </button>
          <button
            type="button"
            className={tab === "ignored" ? "is-active" : ""}
            onClick={() => setTab("ignored")}
          >
            <CircleSlash size={16} />
            Leads ignorados
            {ignoredLeads.length > 0 && <span className="settingsBadge">{ignoredLeads.length}</span>}
          </button>
        </nav>
      </aside>

      <div className="settingsContent">
        {tab === "profile" ? (
          <ProfileForm profile={profile} onSave={onSaveProfile} setNotice={setNotice} />
        ) : (
          <IgnoredLeadsPanel
            leads={ignoredLeads}
            onRestore={onRestoreLead}
            onDelete={onDeleteLead}
          />
        )}
      </div>
    </section>
  );
}

function ProfileForm({
  profile,
  onSave,
  setNotice
}: {
  profile: CompanyProfile;
  onSave: (profile: CompanyProfile) => void;
  setNotice: (notice: string) => void;
}) {
  const [draft, setDraft] = useState<CompanyProfile>(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  async function persist() {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (response.ok && data.profile) {
        onSave(data.profile);
        setNotice("Perfil salvo.");
      } else {
        setNotice(data.error ?? "Nao consegui salvar o perfil.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glassPanel profileCard">
      <span className="sectionLabel">Perfil da empresa</span>
      <h2>{draft.brandName || "Sua marca"}</h2>
      <p>Configure aqui o posicionamento usado nos insights e nas mensagens de abordagem.</p>
      <label>
        Nome da marca
        <input value={draft.brandName} onChange={(event) => setDraft({ ...draft, brandName: event.target.value })} />
      </label>
      <label>
        Oferta principal
        <input value={draft.offer} onChange={(event) => setDraft({ ...draft, offer: event.target.value })} />
      </label>
      <label>
        Região foco
        <input value={draft.focusRegion} onChange={(event) => setDraft({ ...draft, focusRegion: event.target.value })} />
      </label>
      <label>
        Tom da abordagem
        <input value={draft.tone} onChange={(event) => setDraft({ ...draft, tone: event.target.value })} />
      </label>
      <label>
        Assinatura (opcional)
        <input value={draft.signature ?? ""} onChange={(event) => setDraft({ ...draft, signature: event.target.value })} placeholder="Ex: Gustavo - Grynd" />
      </label>
      <button className="primaryButton" disabled={saving} onClick={() => void persist()} type="button">
        <Save size={16} />
        {saving ? "Salvando..." : "Salvar perfil"}
      </button>
    </div>
  );
}

function IgnoredLeadsPanel({
  leads,
  onRestore,
  onDelete
}: {
  leads: Lead[];
  onRestore: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  return (
    <div className="glassPanel ignoredCard">
      <span className="sectionLabel">Leads ignorados</span>
      <h2>{leads.length} {leads.length === 1 ? "lead ignorado" : "leads ignorados"}</h2>
      <p>Restaure pra voltar pros salvos, ou apague de vez. Ignorados ficam 90 dias antes de sumir automaticamente.</p>

      {leads.length === 0 ? (
        <div className="emptyState">
          <strong>Nenhum lead ignorado</strong>
          <span>Leads que você ignorar aparecerão aqui.</span>
        </div>
      ) : (
        <ul className="ignoredList">
          {leads.map((lead) => (
            <li key={lead.id} className="ignoredItem">
              <div>
                <strong>{lead.name}</strong>
                <span>{lead.category} · {lead.city}</span>
              </div>
              <div className="ignoredActions">
                <button type="button" onClick={() => onRestore(lead)} title="Restaurar pra salvos">
                  <RefreshCw size={14} />
                  Restaurar
                </button>
                <button type="button" onClick={() => onDelete(lead)} title="Excluir permanentemente">
                  <CircleSlash size={14} />
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function dataLabel(value: DataFilter) {
  if (value === "whatsapp") return "WhatsApp";
  if (value === "social") return "Rede social";
  if (value === "site") return "Site";
  return "Todos";
}

function mergeLeads(current: Lead[], incoming: Lead[]) {
  const byId = new Map(current.map((lead) => [lead.id, lead]));
  incoming.forEach((lead) => byId.set(lead.id, lead));
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function buildInsight(lead: Lead) {
  const channels = [
    lead.website ? "tem site" : "nao tem site visivel",
    lead.instagram || lead.facebook ? "tem rede social" : "rede social nao encontrada",
    lead.whatsapp || lead.phone ? "tem contato direto" : "telefone ainda nao validado"
  ].join(", ");
  return `${lead.name} parece ser uma empresa ${sizeLabels[lead.companySize].toLowerCase()} no nicho ${lead.niche}. Oportunidade: ${channels}. Melhor proximo passo: ${lead.nextAction}`;
}

function formatWhatsAppLead(lead: Lead, profile: CompanyProfile) {
  const brand = profile.brandName || "nossa equipe";
  const opener = openerByCompanySize(lead, brand);
  const offer = profile.offer ? `O que a gente faz: ${profile.offer}.` : undefined;
  const siteLine = lead.website ? `Dei uma olhada no site (${lead.website})` : "Nao achei um site publico de voces";
  const socialLine = lead.instagram ? ` e no Instagram (${lead.instagram})` : "";
  const closer = closerByCompanySize(lead);
  const signature = profile.signature ? `\n— ${profile.signature}` : "";

  return [opener, `${siteLine}${socialLine}.`, offer, closer]
    .filter(Boolean)
    .join("\n") + signature;
}

function openerByCompanySize(lead: Lead, brand: string) {
  if (lead.companySize === "grande") {
    return `Oi, tudo bem? Falo da ${brand}. Estou prospectando parcerias com unidades do ${lead.name} na regiao.`;
  }
  if (lead.companySize === "media") {
    return `Oi, tudo bem? Falo da ${brand}. Vi o ${lead.name} e queria trocar uma ideia rapida com voces.`;
  }
  return `Oi, tudo bem? Falo da ${brand}. Vi o ${lead.name} aqui da regiao e queria te mandar uma sugestao rapida.`;
}

function buildLeadsCsv(leads: Lead[]): Blob {
  // Ordem lógica pra prospecção: identificação → contato → web → metadados
  const headers = [
    "Nome",
    "Categoria",
    "Porte",
    "WhatsApp",
    "Telefone",
    "Email",
    "Site",
    "Instagram",
    "Facebook",
    "Endereco",
    "Cidade",
    "Score",
    "Avaliacao",
    "Avaliacoes",
    "Status",
    "Nicho",
    "Maps"
  ];

  // Formata telefone BR: 5519999999999 → +55 (19) 99999-9999
  const formatPhone = (raw?: string) => {
    if (!raw) return "";
    const d = raw.replace(/\D/g, "");
    if (d.length === 13 && d.startsWith("55")) {
      return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    }
    if (d.length === 12 && d.startsWith("55")) {
      return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
    }
    if (d.length === 11) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    return raw;
  };

  const rows = leads.map((lead) => [
    lead.name,
    lead.category,
    sizeLabels[lead.companySize],
    formatPhone(lead.whatsapp),
    formatPhone(lead.phone),
    lead.email ?? "",
    lead.website ?? "",
    lead.instagram ?? "",
    lead.facebook ?? "",
    lead.address ?? "",
    lead.city ?? "",
    String(lead.score ?? ""),
    lead.rating != null ? lead.rating.toFixed(1).replace(".", ",") : "",
    lead.reviewCount != null ? String(lead.reviewCount) : "",
    statusLabel(lead.status),
    lead.niche,
    lead.mapsUrl ?? ""
  ]);

  // Excel BR usa `;` como delimitador padrão. A primeira linha `sep=;` força
  // Excel a interpretar corretamente independente da config regional do usuário.
  const SEP = ";";
  const escape = (value: string) => {
    const safe = String(value ?? "");
    // Quote sempre — evita problemas com ; , " \n em qualquer campo
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [
    `sep=${SEP}`,
    headers.map(escape).join(SEP),
    ...rows.map((row) => row.map(escape).join(SEP))
  ].join("\r\n");

  // BOM UTF-8 pro Excel reconhecer acentos
  return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
}

function statusLabel(status: Lead["status"]): string {
  switch (status) {
    case "new":
      return "Novo";
    case "saved":
      return "Salvo";
    case "sent":
      return "Enviado";
    case "contacted":
      return "Contatado";
    case "ignored":
      return "Ignorado";
    default:
      return status;
  }
}

function closerByCompanySize(lead: Lead) {
  if (lead.companySize === "grande") {
    return "Quem cuida do marketing/digital ai pode receber 2 minutos de mensagem com uma sugestao especifica?";
  }
  if (lead.companySize === "media") {
    return "Voce e a pessoa que cuida do marketing? Posso mandar 3 ideias objetivas pra acelerar resultado.";
  }
  return "Posso te mandar uma sugestao curta sobre presenca digital? Sao 2 minutos de leitura.";
}
