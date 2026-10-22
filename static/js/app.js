/**
 * app.js - Application Controller & RBAC Workspace
 */
const SEED_FALLBACK_TICKETS = [
  {
    id: 1,
    ticket_number: "TCK-1001",
    title: "Production Database Connection Pool Exhausted",
    description: "High connection spike causing HTTP 500 across checkout API. Database threads locked and queries timing out.",
    customer_id: 1,
    customer_name: "Alex Chen (Client)",
    status: "QUEUED",
    priority_score: 92.5,
    severity: "CRITICAL",
    category: "INFRASTRUCTURE",
    queue_tier: "PRIORITY_HEAP",
    created_at: Date.now() / 1000 - 1800,
    sla_hours: 1
  },
  {
    id: 2,
    ticket_number: "TCK-1002",
    title: "Potential Security Breach: Unauthorized Token Influx",
    description: "Suspicious IP range hitting admin endpoints with brute-force API authentication attempts.",
    customer_id: 1,
    customer_name: "Alex Chen (Client)",
    status: "CLAIMED",
    priority_score: 88.0,
    severity: "CRITICAL",
    category: "SECURITY",
    queue_tier: "PRIORITY_HEAP",
    created_at: Date.now() / 1000 - 1200,
    sla_hours: 1
  },
  {
    id: 3,
    ticket_number: "TCK-1003",
    title: "Stripe Double Billing Webhook Duplicate Charge",
    description: "Customers reported being charged twice on annual plan invoice #INV-4921.",
    customer_id: 1,
    customer_name: "Alex Chen (Client)",
    status: "QUEUED",
    priority_score: 64.0,
    severity: "HIGH",
    category: "BILLING",
    queue_tier: "PRIORITY_HEAP",
    created_at: Date.now() / 1000 - 900,
    sla_hours: 4
  },
  {
    id: 4,
    ticket_number: "TCK-1004",
    title: "CSV Export Button Missing Date Range Filter",
    description: "Customer reports the reports tab exports all historical rows instead of respecting the Q3 filter.",
    customer_id: 1,
    customer_name: "Alex Chen (Client)",
    status: "QUEUED",
    priority_score: 32.0,
    severity: "MEDIUM",
    category: "APPLICATION_BUG",
    queue_tier: "FIFO_STANDARD",
    created_at: Date.now() / 1000 - 600,
    sla_hours: 12
  },
  {
    id: 5,
    ticket_number: "TCK-1005",
    title: "Dark Mode Font Contrast in Settings Panel",
    description: "Labels on toggle switch have low contrast on dark theme browsers.",
    customer_id: 1,
    customer_name: "Alex Chen (Client)",
    status: "QUEUED",
    priority_score: 18.0,
    severity: "LOW",
    category: "APPLICATION_BUG",
    queue_tier: "FIFO_STANDARD",
    created_at: Date.now() / 1000 - 300,
    sla_hours: 48
  },
  {
    id: 6,
    ticket_number: "TCK-1006",
    title: "Feature Request: Webhook Notification for Slack",
    description: "Would like to receive real-time ticket escalation alerts in team channel.",
    customer_id: 1,
    customer_name: "Alex Chen (Client)",
    status: "QUEUED",
    priority_score: 22.0,
    severity: "LOW",
    category: "FEATURE_REQUEST",
    queue_tier: "FIFO_STANDARD",
    created_at: Date.now() / 1000 - 150,
    sla_hours: 48
  }
];

class OmniQueueApp {
  constructor() {
    this.currentRole = "ADMIN"; // Default: ADMIN, AGENT, CUSTOMER
    this.allTickets = [...SEED_FALLBACK_TICKETS];
    this.triageDebounceTimer = null;
    this.selectedTicket = null;

    this.init();
  }

  init() {
    this.renderTicketList(this.allTickets);
    this.applyRoleView();
    this.bindRoleSwitcher();
    this.bindFormEvents();
    this.bindSearch();
    this.bindActionButtons();
    this.loadTickets();
    this.loadMetrics();
    this.loadAnalytics();
    this.loadAuditLogs();

    document.getElementById("btn-refresh-analytics")?.addEventListener("click", () => {
      this.loadAnalytics();
      this.loadAuditLogs();
      window.showToast("Operations telemetry refreshed from SQLite database.", "info");
    });

    // Refresh data periodically
    setInterval(() => {
      this.loadTickets();
      this.loadMetrics();
      this.loadAnalytics();
      this.loadAuditLogs();
    }, 4000);
  }

  bindRoleSwitcher() {
    document.querySelectorAll(".role-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".role-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentRole = btn.dataset.role;
        this.applyRoleView();
        window.showToast(`Active role switched to: ${this.currentRole}`, "info");
      });
    });
  }

  applyRoleView() {
    const roleIndicator = document.getElementById("active-role-indicator");
    if (roleIndicator) roleIndicator.textContent = this.currentRole;

    const customerPanel = document.getElementById("panel-customer");
    const agentActions = document.querySelectorAll(".agent-only");
    const adminActions = document.querySelectorAll(".admin-only");

    if (this.currentRole === "CUSTOMER") {
      agentActions.forEach((el) => el.style.display = "none");
      adminActions.forEach((el) => el.style.display = "none");
      if (customerPanel) customerPanel.style.display = "block";
    } else if (this.currentRole === "AGENT") {
      agentActions.forEach((el) => el.style.display = "flex");
      adminActions.forEach((el) => el.style.display = "none");
      if (customerPanel) customerPanel.style.display = "none";
    } else {
      // ADMIN
      agentActions.forEach((el) => el.style.display = "flex");
      adminActions.forEach((el) => el.style.display = "flex");
      if (customerPanel) customerPanel.style.display = "block";
    }
  }

  bindFormEvents() {
    const titleInput = document.getElementById("ticket-title");
    const descInput = document.getElementById("ticket-desc");
    const createForm = document.getElementById("create-ticket-form");

    // Real-time live AI preview on EVERY keystroke
    const triggerPreview = () => {
      this.previewTriage();
    };

    titleInput?.addEventListener("input", triggerPreview);
    descInput?.addEventListener("input", triggerPreview);

    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.submitTicket();
    });
  }

  computeLocalTriage(title, desc) {
    const text = `${title} ${desc}`.toLowerCase();
    let score = 20;
    const criticals = ["outage", "down", "crash", "security", "breach", "leak", "fatal", "production", "blocked", "exploit", "ddos", "locked"];
    const highs = ["slow", "latency", "timeout", "500", "502", "cannot login", "auth", "refund", "billing", "fail", "broken"];
    
    criticals.forEach(kw => { if (text.includes(kw)) score += 32; });
    highs.forEach(kw => { if (text.includes(kw)) score += 16; });

    score = Math.min(99, Math.max(5, Math.round(score)));
    let severity = "LOW";
    let sla = 48;
    let action = "Standard Queue Routing. Check user documentation and test cases.";
    if (score >= 75) {
      severity = "CRITICAL";
      sla = 1;
      action = "Immediate Escalation to Tier-3 Incident Commander. Open War-Room.";
    } else if (score >= 50) {
      severity = "HIGH";
      sla = 4;
      action = "Assign to Specialist Engineer. Investigate logs and telemetry.";
    } else if (score >= 30) {
      severity = "MEDIUM";
      sla = 12;
      action = "Standard Queue Routing. Check user documentation and test cases.";
    }

    let category = "GENERAL_SUPPORT";
    if (text.includes("security") || text.includes("auth") || text.includes("breach") || text.includes("token")) category = "SECURITY";
    else if (text.includes("database") || text.includes("server") || text.includes("outage") || text.includes("disk")) category = "INFRASTRUCTURE";
    else if (text.includes("billing") || text.includes("payment") || text.includes("stripe") || text.includes("charge")) category = "BILLING";
    else if (text.includes("bug") || text.includes("error") || text.includes("crash") || text.includes("glitch")) category = "APPLICATION_BUG";
    else if (text.includes("request") || text.includes("feature") || text.includes("theme")) category = "FEATURE_REQUEST";

    return {
      priority_score: score,
      severity: severity,
      category: category,
      sla_hours: sla,
      suggested_action: action
    };
  }

  previewTriage() {
    const title = document.getElementById("ticket-title")?.value || "";
    const desc = document.getElementById("ticket-desc")?.value || "";

    if (!title.trim() && !desc.trim()) {
      const card = document.getElementById("ai-triage-preview");
      if (card) card.style.display = "none";
      return;
    }

    // 1. Instant 0ms client-side calculation
    const local = this.computeLocalTriage(title, desc);
    this.renderTriagePreview(local);

    // 2. Sync with backend API
    clearTimeout(this.triageDebounceTimer);
    this.triageDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch("/api/tickets/preview-triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: desc }),
        });
        if (res.ok) {
          const serverTriage = await res.json();
          this.renderTriagePreview(serverTriage);
        }
      } catch (err) {
        // Fallback already rendered
      }
    }, 200);
  }

  renderTriagePreview(data) {
    const card = document.getElementById("ai-triage-preview");
    if (!card) return;
    card.style.display = "block";

    document.getElementById("ai-score-val").textContent = data.priority_score;
    document.getElementById("ai-score-fill").style.width = `${Math.min(100, data.priority_score)}%`;

    const sevBadge = document.getElementById("ai-severity-badge");
    sevBadge.className = `badge badge-${data.severity.toLowerCase()}`;
    sevBadge.textContent = data.severity;

    document.getElementById("ai-category-badge").textContent = data.category;
    document.getElementById("ai-sla-val").textContent = `${data.sla_hours}h SLA Target`;
    document.getElementById("ai-action-text").textContent = data.suggested_action;
  }

  async submitTicket() {
    const title = document.getElementById("ticket-title").value;
    const desc = document.getElementById("ticket-desc").value;
    const customerName = document.getElementById("ticket-customer").value || "Alex Chen (Client)";

    if (!title.trim()) {
      window.showToast("Ticket title is required", "alert");
      return;
    }

    const btn = document.getElementById("btn-submit-ticket");
    btn.disabled = true;
    btn.textContent = "Classifying & Enqueueing...";

    // Instant local optimistic insert into ticket list (0ms feedback!)
    const localTriage = this.computeLocalTriage(title, desc);
    const tempId = Date.now();
    const tempTicket = {
      id: tempId,
      ticket_number: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title,
      description: desc,
      customer_name: customerName,
      status: "QUEUED",
      priority_score: localTriage.priority_score,
      severity: localTriage.severity,
      category: localTriage.category,
      queue_tier: (localTriage.severity === "CRITICAL" || localTriage.severity === "HIGH") ? "PRIORITY_HEAP" : "FIFO_STANDARD",
      created_at: Date.now() / 1000,
      sla_hours: localTriage.sla_hours
    };

    this.allTickets.unshift(tempTicket);
    this.renderTicketList(this.allTickets);
    window.showToast(`Ticket ${tempTicket.ticket_number} created & enqueued!`, "success");

    // Clear inputs immediately
    document.getElementById("ticket-title").value = "";
    document.getElementById("ticket-desc").value = "";
    document.getElementById("ai-triage-preview").style.display = "none";

    try {
      const res = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: desc,
          customer_name: customerName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace temp ticket with DB record
        this.allTickets = this.allTickets.filter(t => t.id !== tempId);
        this.allTickets.unshift(data.ticket);
        this.renderTicketList(this.allTickets);
        this.loadMetrics();
        this.loadAnalytics();
        this.loadAuditLogs();
        window.meridianAtelier?.fetchAndRender();
      }
    } catch (err) {
      console.warn("Background sync error:", err);
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit & Auto-Triage";
    }
  }

  bindSearch() {
    const searchInput = document.getElementById("search-tickets");
    let searchDebounce = null;

    searchInput?.addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        this.renderTicketList(this.allTickets);
        return;
      }

      // 1. Instant local filter
      const localMatches = this.allTickets.filter(t => 
        t.title.toLowerCase().includes(query) || 
        t.customer_name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.severity.toLowerCase().includes(query) ||
        t.ticket_number.toLowerCase().includes(query)
      );
      this.renderTicketList(localMatches);

      // 2. Sync with Trie search API
      searchDebounce = setTimeout(async () => {
        try {
          const res = await fetch(`/api/dsa/search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.tickets && data.tickets.length > 0) {
              this.renderTicketList(data.tickets);
            }
          }
        } catch (err) {
          console.warn("Trie search error:", err);
        }
      }, 150);
    });
  }

  bindActionButtons() {
    // Serve Next Ticket (Agent)
    const btnServe = document.getElementById("btn-serve-next");
    btnServe?.addEventListener("click", async () => {
      btnServe.disabled = true;
      try {
        const res = await fetch("/api/tickets/serve-next", { method: "POST" });
        const data = await res.json();
        if (data.status === "success") {
          window.showToast(`Served ${data.ticket.ticket_number} from ${data.queue_source}!`, "success");
          this.loadTickets();
          this.loadMetrics();
          this.loadAnalytics();
          this.loadAuditLogs();
          window.meridianAtelier?.fetchAndRender();
          this.openTicketModal(data.ticket.id);
        } else {
          window.showToast("All priority and standard queues are currently clear!", "info");
        }
      } catch (err) {
        window.showToast("Error serving next ticket", "alert");
      } finally {
        btnServe.disabled = false;
      }
    });

    // Simulate Traffic Surge (Admin)
    const btnSimulate = document.getElementById("btn-simulate-surge");
    btnSimulate?.addEventListener("click", async () => {
      btnSimulate.disabled = true;
      btnSimulate.textContent = "Injecting Surge...";
      try {
        const res = await fetch("/api/simulate-burst", { method: "POST" });
        const data = await res.json();
        if (res.ok) {
          window.showToast(`Simulated surge of ${data.count} enterprise tickets!`, "success");
          this.loadTickets();
          this.loadMetrics();
          this.loadAnalytics();
          this.loadAuditLogs();
          window.meridianAtelier?.fetchAndRender();
        }
      } catch (err) {
        window.showToast("Simulation completed", "info");
      } finally {
        btnSimulate.disabled = false;
        btnSimulate.textContent = "Simulate Traffic Surge";
      }
    });

    // Close Modal
    document.getElementById("btn-close-modal")?.addEventListener("click", () => this.closeModal());
    document.getElementById("ticket-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "ticket-modal") this.closeModal();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeModal();
    });
  }

  closeModal() {
    const modal = document.getElementById("ticket-modal");
    if (modal) {
      modal.setAttribute("hidden", "");
      modal.style.display = "none";
    }
  }

  async loadTickets() {
    try {
      const res = await fetch("/api/tickets");
      if (!res.ok) return;
      const data = await res.json();
      if (data.tickets && data.tickets.length > 0) {
        this.allTickets = data.tickets;
        this.renderTicketList(this.allTickets);
      }
    } catch (err) {
      console.warn("Tickets poll error:", err);
    }
  }

  async loadMetrics() {
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) return;
      const m = await res.json();

      document.getElementById("metric-active").textContent = m.active_queue_count;
      document.getElementById("metric-critical").textContent = m.critical_outages;
      document.getElementById("metric-priority-depth").textContent = m.priority_queue_depth;
      document.getElementById("metric-standard-depth").textContent = m.standard_queue_depth;
      document.getElementById("metric-hit-rate").textContent = m.lru_cache_hit_rate;
    } catch (err) {
      console.warn("Metrics poll error:", err);
    }
  }

  renderTicketList(tickets = this.allTickets) {
    const container = document.getElementById("ticket-list");
    if (!container) return;

    if (!tickets || tickets.length === 0) {
      container.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--muted); font-family:var(--mono); font-size:0.85rem;">No active tickets in queue. Use the sidebar to create one!</div>`;
      return;
    }

    container.innerHTML = tickets.map((t) => {
      const sevClass = `badge-${(t.severity || 'low').toLowerCase()}`;

      return `
        <div class="ticket-card" onclick="window.omniApp?.openTicketModal(${t.id})">
          <div class="ticket-info">
            <div class="ticket-meta">
              <span class="ticket-num">${t.ticket_number}</span>
              <span class="badge ${sevClass}">${t.severity}</span>
              <span class="badge badge-tier">${t.queue_tier === 'PRIORITY_HEAP' ? 'Heap Tier' : 'FIFO Tier'}</span>
              <span style="font-family:var(--mono); font-size:0.68rem; color:var(--muted);">Score: ${t.priority_score}</span>
              <span style="font-family:var(--mono); font-size:0.68rem; color:var(--muted);">· ${t.category}</span>
            </div>
            <div class="ticket-title">${t.title}</div>
            <div class="ticket-desc">${t.description}</div>
          </div>
          <div class="ticket-actions">
            <span class="badge" style="background:color-mix(in srgb, var(--void) 60%, transparent); border:1px solid var(--line);">
              ${t.status}
            </span>
            <span class="sla-tag">${t.customer_name}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  populateModal(t, source) {
    this.selectedTicket = t;
    document.getElementById("modal-ticket-num").textContent = `${t.ticket_number} · ${t.category}`;
    document.getElementById("modal-ticket-title").textContent = t.title;
    document.getElementById("modal-ticket-desc").textContent = t.description;
    document.getElementById("modal-ticket-source").textContent = source || "LRU_CACHE (O(1) Memory Hit)";
    document.getElementById("modal-ticket-customer").textContent = t.customer_name;
    document.getElementById("modal-ticket-severity").textContent = `${t.severity} (Score: ${t.priority_score})`;
    document.getElementById("modal-ticket-status").textContent = t.status;

    // Agent resolution buttons
    const actionArea = document.getElementById("modal-agent-actions");
    if (actionArea) {
      if (this.currentRole === "CUSTOMER") {
        actionArea.style.display = "none";
      } else {
        actionArea.style.display = "flex";
      }
    }
  }

  async openTicketModal(ticketId) {
    const modal = document.getElementById("ticket-modal");
    if (!modal) return;

    // 1. Instant local render (0ms response)
    const localT = this.allTickets.find(t => t.id === ticketId);
    if (localT) {
      this.populateModal(localT, "LRU_CACHE (O(1) Memory Hit)");
      modal.removeAttribute("hidden");
      modal.style.display = "grid";
    }

    // 2. Fetch fresh record from backend API
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.ok) {
        const payload = await res.json();
        this.populateModal(payload.ticket, payload.source);
        modal.removeAttribute("hidden");
        modal.style.display = "grid";
      }
    } catch (err) {
      console.warn("Modal fetch error:", err);
    }
  }

  async updateCurrentTicketStatus(newStatus) {
    if (!this.selectedTicket) return;
    const notes = document.getElementById("modal-resolution-notes")?.value || "";

    try {
      const res = await fetch(`/api/tickets/${this.selectedTicket.id}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          actor_username: "sarah_agent",
          actor_role: this.currentRole,
          resolution_notes: notes,
        }),
      });

      if (res.ok) {
        window.showToast(`Ticket #${this.selectedTicket.id} marked as ${newStatus}!`, "success");
        this.closeModal();
        this.loadTickets();
        this.loadMetrics();
        this.loadAnalytics();
        this.loadAuditLogs();
        window.meridianAtelier?.fetchAndRender();
      }
    } catch (err) {
      window.showToast("Failed to update status", "alert");
    }
  }

  async loadAnalytics() {
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) return;
      const data = await res.json();

      // SLA Compliance
      const rateEl = document.getElementById("sla-compliance-rate");
      if (rateEl) rateEl.textContent = data.sla_compliance_rate;
      const badgeEl = document.getElementById("sla-rate-badge");
      if (badgeEl) badgeEl.textContent = `${data.sla_compliance_rate} SLA Match`;

      document.getElementById("sla-ontime-val").textContent = data.sla_on_time_count;
      document.getElementById("sla-breached-val").textContent = data.sla_breached_count;

      // Severity bars
      const sev = data.severity_distribution || {};
      const total = Object.values(sev).reduce((a, b) => a + b, 0) || 1;

      document.getElementById("dist-critical-count").textContent = `${sev.CRITICAL || 0} (${Math.round((sev.CRITICAL || 0) / total * 100)}%)`;
      document.getElementById("dist-high-count").textContent = `${sev.HIGH || 0} (${Math.round((sev.HIGH || 0) / total * 100)}%)`;
      document.getElementById("dist-medium-count").textContent = `${sev.MEDIUM || 0} (${Math.round((sev.MEDIUM || 0) / total * 100)}%)`;
      document.getElementById("dist-low-count").textContent = `${sev.LOW || 0} (${Math.round((sev.LOW || 0) / total * 100)}%)`;

      document.getElementById("bar-critical").style.width = `${((sev.CRITICAL || 0) / total) * 100}%`;
      document.getElementById("bar-high").style.width = `${((sev.HIGH || 0) / total) * 100}%`;
      document.getElementById("bar-medium").style.width = `${((sev.MEDIUM || 0) / total) * 100}%`;
      document.getElementById("bar-low").style.width = `${((sev.LOW || 0) / total) * 100}%`;

      // Category breakdown
      const catContainer = document.getElementById("category-pills-container");
      if (catContainer) {
        const cats = data.category_distribution || {};
        catContainer.innerHTML = Object.entries(cats).map(([catName, count]) => `
          <div style="display:flex; justify-content:space-between; align-items:center; font-family:var(--mono); font-size:0.72rem; padding:0.35rem 0.6rem; border:1px solid var(--line); background:color-mix(in srgb, var(--void) 50%, transparent); border-radius:3px;">
            <span>${catName}</span>
            <span class="badge badge-tier">${count} tickets</span>
          </div>
        `).join("");
      }

      // Agent Workloads
      const agentGrid = document.getElementById("agent-workload-grid");
      if (agentGrid) {
        agentGrid.innerHTML = (data.agent_workloads || []).map((ag) => `
          <div style="padding:1.1rem; border:1px solid var(--line); background:var(--panel); border-radius:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <span style="font-family:var(--mono); font-size:0.68rem; color:var(--patina);">● ${ag.status}</span>
              <span class="badge" style="background:color-mix(in srgb, var(--void) 70%, transparent); border:1px solid var(--line);">${ag.active_tickets} Active</span>
            </div>
            <div style="font-weight:600; font-size:0.92rem; color:var(--ink); margin-bottom:0.2rem;">${ag.name}</div>
            <div style="font-family:var(--mono); font-size:0.7rem; color:var(--muted);">${ag.role}</div>
          </div>
        `).join("");
      }
    } catch (err) {
      console.warn("Analytics poll error:", err);
    }
  }

  async loadAuditLogs() {
    try {
      const res = await fetch("/api/audit-logs?limit=30");
      if (!res.ok) return;
      const data = await res.json();
      const tbody = document.getElementById("audit-table-body");
      if (!tbody) return;

      if (!data.logs || data.logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:1.5rem; text-align:center; color:var(--muted);">No audit transactions found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.logs.map((log) => {
        const timeStr = new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `
          <tr style="border-bottom:1px solid color-mix(in srgb, var(--line) 40%, transparent);">
            <td style="padding:0.65rem 1rem; color:var(--muted); white-space:nowrap;">${timeStr}</td>
            <td style="padding:0.65rem 1rem; color:var(--brass); white-space:nowrap;">${log.actor_username} <span style="font-size:0.65rem; color:var(--muted);">(${log.actor_role})</span></td>
            <td style="padding:0.65rem 1rem;"><span class="badge" style="border:1px solid var(--line);">${log.action}</span></td>
            <td style="padding:0.65rem 1rem; color:var(--patina);">${log.ticket_id ? `#${log.ticket_id}` : 'SYSTEM'}</td>
            <td style="padding:0.65rem 1rem; color:var(--ink);">${log.details}</td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.warn("Audit logs poll error:", err);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.omniApp = new OmniQueueApp();
  });
} else {
  window.omniApp = new OmniQueueApp();
}
