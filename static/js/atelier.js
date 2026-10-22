/**
 * atelier.js - Real Live DSA Visualizer Studio
 * Visualizes in-memory algorithms in real time:
 *   1. Priority Heap (Binary Tree & Array representation with aging)
 *   2. FIFO Queue (Conveyor belt animation)
 *   3. LRU Cache (Doubly Linked List with Hit/Miss telemetry)
 *   4. Incident Remediation DAG (Topological ordering & dependencies)
 *   5. Circular Ring Buffer (Zero-allocation fixed telemetry)
 */
const SEED_DSA_STATE = {
  priority_heap: {
    size: 3,
    items: [
      { ticket_id: 1, title: "Production Database Connection Pool Exhausted", customer: "Alex Chen", dynamic_score: 92.5, wait_seconds: 45 },
      { ticket_id: 2, title: "Potential Security Breach: Unauthorized Token Influx", customer: "Alex Chen", dynamic_score: 88.0, wait_seconds: 30 },
      { ticket_id: 3, title: "Stripe Double Billing Webhook Duplicate Charge", customer: "Alex Chen", dynamic_score: 64.0, wait_seconds: 15 }
    ],
    tree_array: [
      { index: 0, ticket_id: 1, title: "Production Database Connection Pool Exhausted", dynamic_score: 92.5, parent_idx: null, left_child_idx: 1, right_child_idx: 2 },
      { index: 1, ticket_id: 2, title: "Potential Security Breach: Unauthorized Token Influx", dynamic_score: 88.0, parent_idx: 0, left_child_idx: null, right_child_idx: null },
      { index: 2, ticket_id: 3, title: "Stripe Double Billing Webhook Duplicate Charge", dynamic_score: 64.0, parent_idx: 0, left_child_idx: null, right_child_idx: null }
    ]
  },
  fifo_queue: {
    size: 3,
    items: [
      { ticket_number: "TCK-1004", title: "CSV Export Button Missing Date Range Filter", customer_name: "Alex Chen" },
      { ticket_number: "TCK-1005", title: "Dark Mode Font Contrast in Settings Panel", customer_name: "Alex Chen" },
      { ticket_number: "TCK-1006", title: "Feature Request: Webhook Notification for Slack", customer_name: "Alex Chen" }
    ]
  },
  lru_cache: {
    capacity: 8,
    size: 4,
    hits: 14,
    misses: 2,
    hit_ratio: "87.5%",
    evictions: 0,
    items: [
      { key: 1, value: { title: "Production Database Connection Pool Exhausted" } },
      { key: 2, value: { title: "Potential Security Breach" } },
      { key: 3, value: { title: "Stripe Double Billing" } }
    ]
  },
  task_graph: {
    has_cycle: false,
    topological_order: [
      "1. Triage Root Cause",
      "2. Isolate Failure Domain",
      "3. Apply Hotfix / Patch",
      "4. Failover Replica DB",
      "5. Run Regression Test Suite",
      "6. Deploy to Production & Close"
    ],
    nodes: [
      { id: "1. Triage Root Cause", status: "COMPLETED", can_start: true, in_degree: 0 },
      { id: "2. Isolate Failure Domain", status: "IN_PROGRESS", can_start: true, in_degree: 1 },
      { id: "3. Apply Hotfix / Patch", status: "PENDING", can_start: false, in_degree: 1 },
      { id: "4. Failover Replica DB", status: "PENDING", can_start: false, in_degree: 1 },
      { id: "5. Run Regression Test Suite", status: "PENDING", can_start: false, in_degree: 2 },
      { id: "6. Deploy to Production & Close", status: "PENDING", can_start: false, in_degree: 1 }
    ]
  },
  circular_buffer: {
    capacity: 40,
    current_size: 4,
    head_index: 0,
    tail_index: 4,
    events: [
      { action: "STATUS_UPDATE", actor: "sarah_agent (AGENT)", details: "Ticket #1 status moved to IN_PROGRESS", timestamp: "18:42:10" },
      { action: "SERVE_NEXT", actor: "sarah_agent", details: "Dispatched TCK-1001 via PRIORITY_HEAP", timestamp: "18:41:50" },
      { action: "ENQUEUE_TICKET", actor: "Alex Chen", details: "Created TCK-1001 -> Placed in PRIORITY_HEAP", timestamp: "18:40:00" },
      { action: "SYSTEM_STARTUP", actor: "Kernel (SYSTEM)", details: "DSA Engine synchronized: 3 in Priority Heap, 3 in FIFO Queue.", timestamp: "18:39:00" }
    ]
  }
};

class DSAAtelier {
  constructor() {
    this.currentTab = "heap";
    this.lastState = SEED_DSA_STATE;
    this.initEventListeners();
    // Immediate render with seed state to eliminate any blank delay
    this.render(SEED_DSA_STATE);
    this.fetchAndRender();
    // Poll updates every 4 seconds to keep DSA memory visuals synchronized
    setInterval(() => this.fetchAndRender(), 4000);
  }

  initEventListeners() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentTab = btn.dataset.tab;
        // Instant visual switch using cached state - 0ms delay!
        this.render(this.lastState);
        this.fetchAndRender();
      });
    });
  }

  async fetchAndRender() {
    try {
      const res = await fetch("/api/dsa/state");
      if (!res.ok) return;
      const data = await res.json();
      this.lastState = data;
      this.render(data);
    } catch (err) {
      console.warn("DSA state poll paused:", err);
    }
  }

  render(data) {
    const stage = document.getElementById("atelier-stage");
    if (!stage) return;

    if (this.currentTab === "heap") {
      this.renderPriorityHeap(stage, data.priority_heap);
    } else if (this.currentTab === "queue") {
      this.renderFIFOQueue(stage, data.fifo_queue);
    } else if (this.currentTab === "lru") {
      this.renderLRUCache(stage, data.lru_cache);
    } else if (this.currentTab === "dag") {
      this.renderTaskDAG(stage, data.task_graph);
    } else if (this.currentTab === "ring") {
      this.renderCircularBuffer(stage, data.circular_buffer);
    }
  }

  // 1. PRIORITY HEAP VISUALIZER
  renderPriorityHeap(container, heapData) {
    const items = heapData.items || [];
    const treeArr = heapData.tree_array || [];

    let html = `
      <div class="atelier-head">
        <div>
          <h3 style="font-family: var(--display); font-size: 1.25rem;">Binary Max-Heap with Anti-Starvation Aging</h3>
          <p class="atelier-desc">
            Time Complexity: O(log N) push/pop. Urgent tickets (Critical/High) are prioritized.
            Tickets gain +1.5 priority points per minute of waiting so low-severity requests never starve.
          </p>
        </div>
        <div style="font-family: var(--mono); font-size: 0.75rem; color: var(--brass);">
          Heap Capacity: ${heapData.size} Elements Active
        </div>
      </div>
      
      <div class="heap-container">
        <div>
          <p class="kicker" style="margin-bottom:0.6rem;"><span class="kicker-rule"></span> Memory Array Layout [0 .. N-1]</p>
          <div class="heap-array-row">
    `;

    if (items.length === 0) {
      html += `<div style="color:var(--muted); font-size:0.85rem; padding:1.5rem;">Priority Queue is currently clear. Enqueue tickets to see heapification!</div>`;
    } else {
      items.forEach((item, idx) => {
        const isRoot = idx === 0;
        html += `
          <div class="heap-slot ${isRoot ? 'root' : ''}">
            <div class="heap-slot-idx">Arr[${idx}] ${isRoot ? '★ ROOT' : ''}</div>
            <div class="heap-slot-score">${item.dynamic_score}</div>
            <div class="heap-slot-title" title="${item.title}">#${item.ticket_id} ${item.title}</div>
            <div style="font-family:var(--mono); font-size:0.6rem; color:var(--muted); margin-top:0.3rem;">
              Waited: ${item.wait_seconds}s
            </div>
          </div>
        `;
      });
    }

    html += `
          </div>
        </div>

        <div>
          <p class="kicker" style="margin-bottom:0.6rem;"><span class="kicker-rule"></span> Binary Tree Hierarchy (Parent & Child Pointers)</p>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem;">
    `;

    treeArr.forEach((node) => {
      html += `
        <div style="padding:0.9rem; border:1px solid var(--line); background:var(--panel); border-radius:4px; font-family:var(--mono); font-size:0.72rem;">
          <div style="display:flex; justify-content:space-between; color:var(--brass); font-weight:600; margin-bottom:0.3rem;">
            <span>Node #${node.ticket_id}</span>
            <span>Score: ${node.dynamic_score}</span>
          </div>
          <div style="color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${node.title}</div>
          <div style="margin-top:0.5rem; color:var(--muted); font-size:0.65rem; border-top:1px solid var(--line); padding-top:0.4rem;">
            Parent: ${node.parent_idx !== null ? `Arr[${node.parent_idx}]` : 'ROOT'} | 
            L: ${node.left_child_idx !== null ? `Arr[${node.left_child_idx}]` : '∅'} | 
            R: ${node.right_child_idx !== null ? `Arr[${node.right_child_idx}]` : '∅'}
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // 2. FIFO QUEUE VISUALIZER
  renderFIFOQueue(container, fifoData) {
    const items = fifoData.items || [];
    let html = `
      <div class="atelier-head">
        <div>
          <h3 style="font-family: var(--display); font-size: 1.25rem;">Standard FIFO Queue Pipeline</h3>
          <p class="atelier-desc">
            Time Complexity: O(1) Enqueue, O(1) Dequeue. General inquiries and minor bugs pass through this line in strict arrival sequence.
          </p>
        </div>
        <div style="font-family: var(--mono); font-size: 0.75rem; color: var(--patina);">
          Queue Depth: ${fifoData.size} Tickets
        </div>
      </div>

      <div class="queue-conveyor">
        <div class="queue-label-gate queue-label-head">← HEAD (Next Out)</div>
    `;

    if (items.length === 0) {
      html += `<div style="color:var(--muted); padding:1rem; font-family:var(--mono); font-size:0.8rem;">Queue is empty. New standard tickets enter at Tail.</div>`;
    } else {
      items.forEach((item, idx) => {
        html += `
          <div class="queue-item">
            <div style="font-family:var(--mono); font-size:0.65rem; color:var(--brass); margin-bottom:0.25rem;">
              Pos #${idx + 1} · ${item.ticket_number}
            </div>
            <div style="font-size:0.85rem; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${item.title}
            </div>
            <div style="font-family:var(--mono); font-size:0.68rem; color:var(--muted); margin-top:0.3rem;">
              ${item.customer_name}
            </div>
          </div>
        `;
      });
    }

    html += `
        <div class="queue-label-gate queue-label-tail">TAIL (New In) ←</div>
      </div>
    `;

    container.innerHTML = html;
  }

  // 3. LRU CACHE VISUALIZER
  renderLRUCache(container, lru) {
    const items = lru.items || [];
    let html = `
      <div class="atelier-head">
        <div>
          <h3 style="font-family: var(--display); font-size: 1.25rem;">LRU Ticket Cache (Doubly Linked List + Hash Map)</h3>
          <p class="atelier-desc">
            Time Complexity: O(1) Get / Put. Frequently inspected tickets stay near the Head Sentinel. When capacity (${lru.capacity}) is exceeded, the node before Tail Sentinel is evicted.
          </p>
        </div>
        <div class="lru-stats-bar">
          <span>Hits: <b style="color:var(--patina);">${lru.hits}</b></span>
          <span>Misses: <b style="color:var(--ember);">${lru.misses}</b></span>
          <span>Hit Ratio: <b style="color:var(--brass);">${lru.hit_ratio}</b></span>
          <span>Evictions: <b style="color:var(--gold);">${lru.evictions}</b></span>
        </div>
      </div>

      <div class="lru-visual-wrap">
        <p class="kicker"><span class="kicker-rule"></span> Doubly Linked List Order [MRU Head → LRU Tail]</p>
        <div class="lru-chain">
          <div class="lru-node" style="border-color:var(--brass); min-width:90px;">
            <div style="font-family:var(--mono); font-size:0.65rem; color:var(--brass);">SENTINEL</div>
            <div style="font-weight:600; font-size:0.8rem;">HEAD</div>
          </div>
          <span class="lru-arrow">⇄</span>
    `;

    if (items.length === 0) {
      html += `<div style="color:var(--muted); padding:0.5rem 1rem;">Cache is cold. Click tickets in the workspace to trigger O(1) memory caching!</div>`;
    } else {
      items.forEach((item, idx) => {
        const isMRU = idx === 0;
        const isLRU = idx === items.length - 1 && items.length >= lru.capacity;
        html += `
          <div class="lru-node ${isMRU ? 'mru' : ''} ${isLRU ? 'lru-evict' : ''}">
            <div style="font-family:var(--mono); font-size:0.6rem; color:${isMRU ? 'var(--patina)' : 'var(--muted)'};">
              ${isMRU ? '★ MOST RECENT' : isLRU ? '⚠ NEXT TO EVICT' : `Rank #${idx + 1}`}
            </div>
            <div style="font-weight:600; font-size:0.88rem; margin:0.2rem 0; color:var(--ink);">
              #${item.key}
            </div>
            <div style="font-size:0.7rem; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${item.value?.title || 'Cached Record'}
            </div>
          </div>
          <span class="lru-arrow">⇄</span>
        `;
      });
    }

    html += `
          <div class="lru-node" style="border-color:var(--ember); min-width:90px;">
            <div style="font-family:var(--mono); font-size:0.65rem; color:var(--ember);">SENTINEL</div>
            <div style="font-weight:600; font-size:0.8rem;">TAIL</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // 4. DAG TASK GRAPH VISUALIZER
  renderTaskDAG(container, dag) {
    const nodes = dag.nodes || [];
    const topo = dag.topological_order || [];

    let html = `
      <div class="atelier-head">
        <div>
          <h3 style="font-family: var(--display); font-size: 1.25rem;">Incident Remediation DAG (Kahn's Topological Sort)</h3>
          <p class="atelier-desc">
            Time Complexity: O(V + E). Models complex incident resolution where prerequisites (e.g. Failure Domain Isolation) must execute before deploying hotfixes.
          </p>
        </div>
        <div style="font-family: var(--mono); font-size: 0.75rem; color: var(--patina);">
          Cycle Check: ${dag.has_cycle ? '<span style="color:var(--ember);">CYCLE DETECTED</span>' : 'VALID DAG (Acyclic)'}
        </div>
      </div>

      <div>
        <p class="kicker"><span class="kicker-rule"></span> Optimal Execution Sequence (Topological Order)</p>
        <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin:0.8rem 0 1.5rem;">
    `;

    topo.forEach((step, idx) => {
      html += `
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <div style="padding:0.45rem 0.8rem; background:color-mix(in srgb, var(--void) 70%, transparent); border:1px solid var(--line); border-radius:4px; font-family:var(--mono); font-size:0.75rem;">
            <span style="color:var(--brass); font-weight:600;">Step ${idx + 1}:</span> ${step}
          </div>
          ${idx < topo.length - 1 ? '<span style="color:var(--muted);">→</span>' : ''}
        </div>
      `;
    });

    html += `
        </div>
        <p class="kicker"><span class="kicker-rule"></span> Active Node Dependency Matrix</p>
        <div class="dag-nodes-grid">
    `;

    nodes.forEach((n) => {
      html += `
        <div class="dag-card ${n.can_start ? 'ready' : 'blocked'}">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-family:var(--mono); font-size:0.7rem;">
            <span style="color:${n.can_start ? 'var(--patina)' : 'var(--muted)'};">
              ${n.can_start ? '● READY TO RUN' : '○ BLOCKED'}
            </span>
            <span>In-Degree: ${n.in_degree}</span>
          </div>
          <div style="font-weight:600; font-size:0.88rem;">${n.id}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // 5. CIRCULAR BUFFER TELEMETRY VISUALIZER
  renderCircularBuffer(container, ring) {
    const events = ring.events || [];
    let html = `
      <div class="atelier-head">
        <div>
          <h3 style="font-family: var(--display); font-size: 1.25rem;">Circular Telemetry Buffer (Zero-Allocation Ring)</h3>
          <p class="atelier-desc">
            Time Complexity: O(1) Push. Head index: ${ring.head_index}, Tail index: ${ring.tail_index}. Fixed capacity (${ring.capacity}) guarantees fixed memory consumption under massive load.
          </p>
        </div>
        <div style="font-family: var(--mono); font-size: 0.75rem; color: var(--brass);">
          Buffer Load: ${ring.current_size} / ${ring.capacity} Slots
        </div>
      </div>

      <div class="telemetry-stream">
    `;

    if (events.length === 0) {
      html += `<div style="color:var(--muted); padding:1rem;">Telemetry stream idle.</div>`;
    } else {
      events.forEach((ev) => {
        html += `
          <div class="telemetry-row">
            <span class="telemetry-time">${ev.timestamp || 'Recent'}</span>
            <span class="telemetry-act">[${ev.action}]</span>
            <span class="telemetry-detail">${ev.actor}: ${ev.details}</span>
          </div>
        `;
      });
    }

    html += `
      </div>
    `;

    container.innerHTML = html;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.meridianAtelier = new DSAAtelier();
  });
} else {
  window.meridianAtelier = new DSAAtelier();
}
