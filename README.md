# Meridian · OmniQueue
### Enterprise Incident Orchestration Platform & AI Triage Engine

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3_SQL-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![WebGL](https://img.shields.io/badge/UI-WebGL_Shader-990000?logo=webgl&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com)

An asynchronous, multi-tiered incident management operating system featuring real-time NLP severity classification, dynamic Max-Heap SLA scheduling, $O(1)$ LRU caching, and an interactive WebGL operations dashboard.

---

## 📸 Live Application Preview

### 1. Hero Operations & Real-Time KPI Strip
![Hero Dashboard Preview](assets/hero_preview.png)

### 2. Live SLA Analytics & Incident Audit Center
![Live SLA Analytics and Incident Audit Center](assets/analytics_preview.png)

---

## ⚡ Core Technical Features

- **Dual-Tier Queue Architecture**:
  - **Priority Max-Heap ($O(\log N)$)**: Critical & High severity tickets jump directly to the front.
  - **Dynamic SLA Aging**: Low-priority tickets gain $+1.5\text{ pts/min}$ in waiting to prevent thread starvation.
  - **FIFO Queue ($O(1)$)**: Standard conveyor for routine feature requests & minor questions.
- **AI/ML Incident Triage Pipeline**:
  - Multi-factor NLP tokenizer matching domain urgency lexicons (`outage`, `crash`, `breach`, `leak`).
  - Sentiment polarity & distress scoring to calculate composite priority index (1–100) and allocate automated SLA targets (1h to 48h).
- **In-Memory Algorithm Suite**:
  - **LRU Cache ($O(1)$)**: Doubly Linked List with Sentinel Head & Tail for instant hot ticket detail queries.
  - **Prefix Trie ($O(L)$)**: Instant autocomplete search across customer names, categories, and titles.
  - **Incident Workflow DAG ($O(V + E)$)**: Kahn's Algorithm for topological ordering of incident remediation steps.
  - **Ring Buffer ($O(1)$)**: Zero-allocation circular telemetry stream tracking audit events.
- **Role-Based Access Control (RBAC)**:
  - **Client / Customer**: Ticket creation with live keystroke AI triage preview and SLA tracking.
  - **Support Agent**: High-priority dispatching (`Serve Next Ticket`) and runbook execution.
  - **Admin / Incident Commander**: Global operations control and synthetic traffic burst simulations.

---

## ⏱️ Algorithmic Complexity

| Data Structure | Role in System | Time Complexity | Space Complexity |
| :--- | :--- | :--- | :--- |
| **Binary Max-Heap** | Urgency dispatch | Push/Pop: $O(\log N)$ | $O(N)$ |
| **SLA Aging** | Anti-starvation formula | Re-heapify: $O(N)$ | $O(1)$ |
| **LRU Cache** | Hot ticket lookup | Get/Put/Evict: $O(1)$ | $O(C)$ |
| **Prefix Trie** | Autocomplete search | Search: $O(L)$ | $O(\Sigma \cdot L \cdot N)$ |
| **Workflow DAG** | Incident resolution tasks | Topo-sort: $O(V + E)$ | $O(V + E)$ |
| **Ring Buffer** | Telemetry logs | Append: $O(1)$ | $O(K)$ fixed |

---

## 🚀 Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/meridian-omniqueue.git
   cd meridian-omniqueue
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Launch the server**:
   - On Windows: Double-click **`start.bat`** (or run `python app.py`)
   - On Linux/macOS: `python3 app.py`

4. Open your browser:
   - Web Application: **`http://127.0.0.1:8000`**
   - Interactive Swagger API: **`http://127.0.0.1:8000/docs`**

---

## 🌐 Deploy to Vercel (Recommended)

1. Push this repository to your GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your `meridian-omniqueue` GitHub repository.
4. Vercel will automatically detect `vercel.json` and deploy it instantly.
5. Your live URL will be active (e.g. `https://meridian-omniqueue.vercel.app`).

---

## 📄 Resume Project Summary

- **Enterprise Incident Orchestrator & AI Triage Engine (Python, FastAPI, SQLite, WebGL)**:
  - Engineered an asynchronous incident management platform evolving legacy single-queue mechanics into a dual-tier dispatch system with **FastAPI**, **SQLite**, and in-memory data structures.
  - Built an automated **NLP Triage Pipeline** performing tokenization and distress scoring to calculate dynamic priority indices (1–100) and allocate automated SLA targets.
  - Implemented core data structures from scratch: a **Binary Max-Heap** with anti-starvation dynamic aging ($O(\log N)$), an **LRU Cache** ($O(1)$), a **Prefix Trie** ($O(L)$), and an incident **DAG with Kahn's Topological Sort** ($O(V+E)$).
