"""
app.py - Enterprise Multi-Tier Ticket Orchestrator & DSA Atelier
===================================================================
Production-Grade FastAPI Application combining:
  - Full REST API with SQLite SQL persistence
  - Live in-memory Data Structure synchronization (Heap, FIFO, Ring, LRU, Trie, DAG)
  - AI/ML automated NLP Triage Engine
  - Role-Based Access Control (Customer, Agent, Admin)
  - Real-time simulation and WebGL motion front-end
"""

import time
import os
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

import database as db
from dsa_engine import PriorityHeap, FIFOQueue, CircularBuffer, LRUCache, Trie, TaskGraph, HeapNode
from ai_triage import triage_model

# ---------------------------------------------------------------------
# Global In-Memory DSA Engine Instances
# ---------------------------------------------------------------------
priority_heap = PriorityHeap()
fifo_queue = FIFOQueue()
circular_telemetry = CircularBuffer(capacity=40)
lru_ticket_cache = LRUCache(capacity=8)
trie_search = Trie()
remediation_dag = TaskGraph()

def sync_dsa_from_db():
    """Initializes in-memory DSA state from persistent SQLite database."""
    global priority_heap, fifo_queue, lru_ticket_cache, trie_search, circular_telemetry, remediation_dag
    
    # Reset
    priority_heap = PriorityHeap()
    fifo_queue = FIFOQueue()
    trie_search = Trie()
    remediation_dag = TaskGraph()

    # Load active tickets from database
    tickets = db.get_all_tickets()
    now = time.time()

    for t in tickets:
        # Index in Trie
        trie_search.insert(t["title"], t["id"])
        trie_search.insert(t["customer_name"], t["id"])
        trie_search.insert(t["category"], t["id"])
        trie_search.insert(t["severity"], t["id"])

        # Warm LRU cache with active ones
        if t["status"] in ("QUEUED", "CLAIMED", "IN_PROGRESS"):
            lru_ticket_cache.put(t["id"], t)

            # Route to respective DSA queue
            if t["queue_tier"] == "PRIORITY_HEAP":
                node = HeapNode(
                    ticket_id=t["id"],
                    base_score=t["priority_score"],
                    title=t["title"],
                    customer=t["customer_name"],
                    created_at=t["created_at"],
                    severity=t["severity"]
                )
                priority_heap.push(node)
            else:
                fifo_queue.enqueue(t)

    # Initialize DAG subtask workflow for incident remediation
    remediation_dag.add_dependency("1. Triage Root Cause", "2. Isolate Failure Domain")
    remediation_dag.add_dependency("2. Isolate Failure Domain", "3. Apply Hotfix / Patch")
    remediation_dag.add_dependency("2. Isolate Failure Domain", "4. Failover Replica DB")
    remediation_dag.add_dependency("3. Apply Hotfix / Patch", "5. Run Regression Test Suite")
    remediation_dag.add_dependency("4. Failover Replica DB", "5. Run Regression Test Suite")
    remediation_dag.add_dependency("5. Run Regression Test Suite", "6. Deploy to Production & Close")

    # Load recent audit logs to circular buffer
    recent_logs = db.get_recent_audit_logs(limit=25)
    for log in reversed(recent_logs):
        circular_telemetry.append({
            "action": log["action"],
            "actor": f"{log['actor_username']} ({log['actor_role']})",
            "details": log["details"],
            "ticket_id": log["ticket_id"]
        })

    circular_telemetry.append({
        "action": "SYSTEM_STARTUP",
        "actor": "Kernel (SYSTEM)",
        "details": f"DSA Engine synced: {len(priority_heap)} in Priority Heap, {len(fifo_queue)} in FIFO Queue.",
        "ticket_id": 0
    })


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB tables and seed data exist
    db.init_db()
    sync_dsa_from_db()
    yield
    # Shutdown

app = FastAPI(
    title="Meridian Â· OmniQueue Enterprise Ticketing & DSA Atelier",
    version="2.0.0",
    description="Advanced AI Triage, RBAC, and Live DSA Visualizer for Technical Portfolio",
    lifespan=lifespan
)

# Mount static directory
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "static")
try:
    if not os.path.exists(static_dir):
        os.makedirs(static_dir, exist_ok=True)
except Exception:
    pass
app.mount("/static", StaticFiles(directory=static_dir), name="static")


# ---------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------
class TicketCreateRequest(BaseModel):
    title: str
    description: str
    customer_id: int = 1
    customer_name: str = "Alex Chen (Client)"
    force_severity: Optional[str] = None

class StatusUpdateRequest(BaseModel):
    status: str
    actor_username: str = "sarah_agent"
    actor_role: str = "AGENT"
    agent_id: Optional[int] = 2
    agent_name: Optional[str] = "Sarah Jenkins (Lead Agent)"
    resolution_notes: Optional[str] = None

class TriagePreviewRequest(BaseModel):
    title: str
    description: str


# ---------------------------------------------------------------------
# Frontend Route
# ---------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
@app.get("/api/index", response_class=HTMLResponse)
@app.get("/api/index.py", response_class=HTMLResponse)
async def serve_index():
    index_file = os.path.join(current_dir, "templates", "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h2>Templates not loaded yet. Building...</h2>")


# ---------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------
@app.get("/api/tickets")
async def list_tickets(role: str = Query("ADMIN"), status: Optional[str] = None):
    """Fetches tickets from DB with caching telemetry."""
    all_tickets = db.get_all_tickets()
    if status:
        all_tickets = [t for t in all_tickets if t["status"] == status]
    return {
        "count": len(all_tickets),
        "tickets": all_tickets,
        "lru_stats": lru_ticket_cache.get_stats()
    }


@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: int):
    """Demonstrates O(1) LRU Cache lookup before hitting SQLite."""
    # 1. Check LRU Cache
    cached = lru_ticket_cache.get(ticket_id)
    if cached:
        return {"source": "LRU_CACHE (O(1) Memory Hit)", "ticket": cached}
    
    # 2. Cache Miss -> Query SQLite
    ticket = db.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # 3. Store in LRU Cache
    lru_ticket_cache.put(ticket_id, ticket)
    return {"source": "SQLITE_DISK (Cache Miss, Cached)", "ticket": ticket}


@app.post("/api/tickets/preview-triage")
async def preview_triage(req: TriagePreviewRequest):
    """Real-time instant NLP AI triage prediction as the user types."""
    triage_result = triage_model.triage_ticket(req.title, req.description)
    return triage_result


@app.post("/api/tickets/create")
async def create_ticket(req: TicketCreateRequest):
    """
    Submits a ticket through:
      1. AI/ML NLP Triage analysis
      2. SQL persistence in SQLite
      3. In-memory DSA Queue routing (PriorityHeap vs FIFOQueue)
      4. Trie indexing for instant search
      5. LRU Cache insertion
      6. Circular Buffer event stream logging
    """
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    # 1. AI Triage Pipeline
    triage = triage_model.triage_ticket(req.title, req.description)
    severity = req.force_severity or triage["severity"]
    priority_score = triage["priority_score"]
    category = triage["category"]
    sla_hours = triage["sla_hours"]

    # 2. Routing Decision: Critical / High -> Priority Heap; Medium / Low -> FIFO Standard Queue
    queue_tier = "PRIORITY_HEAP" if severity in ("CRITICAL", "HIGH") else "FIFO_STANDARD"

    # 3. Database SQL Insert
    ticket_id = db.insert_ticket(
        title=req.title,
        description=req.description,
        customer_id=req.customer_id,
        customer_name=req.customer_name,
        priority_score=priority_score,
        severity=severity,
        category=category,
        queue_tier=queue_tier,
        sla_hours=sla_hours
    )

    ticket_obj = db.get_ticket_by_id(ticket_id)

    # 4. In-Memory DSA routing
    if queue_tier == "PRIORITY_HEAP":
        node = HeapNode(
            ticket_id=ticket_id,
            base_score=priority_score,
            title=req.title,
            customer=req.customer_name,
            created_at=ticket_obj["created_at"],
            severity=severity
        )
        priority_heap.push(node)
    else:
        fifo_queue.enqueue(ticket_obj)

    # 5. Trie & LRU updates
    trie_search.insert(req.title, ticket_id)
    trie_search.insert(req.customer_name, ticket_id)
    trie_search.insert(category, ticket_id)
    lru_ticket_cache.put(ticket_id, ticket_obj)

    # 6. Ring Buffer Log
    circular_telemetry.append({
        "action": "ENQUEUE_TICKET",
        "actor": req.customer_name,
        "details": f"Created {ticket_obj['ticket_number']} -> Placed in {queue_tier} (Score: {priority_score})",
        "ticket_id": ticket_id
    })

    return {
        "status": "success",
        "ticket": ticket_obj,
        "triage": triage,
        "queue_tier": queue_tier
    }


@app.post("/api/tickets/{ticket_id}/update-status")
async def update_status(ticket_id: int, req: StatusUpdateRequest):
    """Updates status in DB and synchronizes DSA memory."""
    ok = db.update_ticket_status(
        ticket_id=ticket_id,
        status=req.status,
        actor_username=req.actor_username,
        actor_role=req.actor_role,
        agent_id=req.agent_id,
        agent_name=req.agent_name,
        resolution_notes=req.resolution_notes
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Ticket not found or update failed")

    # If resolved, remove from active queue memory
    if req.status in ("RESOLVED", "CANCELLED"):
        priority_heap.remove(ticket_id)
        fifo_queue.remove(ticket_id)

    # Invalidate / update LRU cache
    fresh_ticket = db.get_ticket_by_id(ticket_id)
    if fresh_ticket:
        lru_ticket_cache.put(ticket_id, fresh_ticket)

    circular_telemetry.append({
        "action": f"STATUS_{req.status}",
        "actor": f"{req.actor_username} ({req.actor_role})",
        "details": f"Ticket #{ticket_id} moved to {req.status}. {req.resolution_notes or ''}",
        "ticket_id": ticket_id
    })

    return {"status": "success", "ticket": fresh_ticket}


@app.post("/api/tickets/serve-next")
async def serve_next_ticket(agent_username: str = "sarah_agent"):
    """
    Direct successor to legacy C++ serveTicket():
    Dispatches highest priority ticket from PriorityHeap,
    or falls back to FIFOQueue if PriorityHeap is empty.
    """
    served_node = priority_heap.pop()
    ticket_id = None
    queue_source = ""

    if served_node:
        ticket_id = served_node.ticket_id
        queue_source = "PRIORITY_HEAP (Highest Dynamic Score)"
    else:
        fifo_item = fifo_queue.dequeue()
        if fifo_item:
            ticket_id = fifo_item["id"]
            queue_source = "FIFO_STANDARD (Oldest Ticket In Line)"

    if not ticket_id:
        return {"status": "empty", "message": "All queues are currently clear!"}

    # Mark as CLAIMED by agent
    db.update_ticket_status(
        ticket_id=ticket_id,
        status="CLAIMED",
        actor_username=agent_username,
        actor_role="AGENT",
        agent_id=2,
        agent_name="Sarah Jenkins (Lead Agent)"
    )

    ticket = db.get_ticket_by_id(ticket_id)
    lru_ticket_cache.put(ticket_id, ticket)

    circular_telemetry.append({
        "action": "SERVE_NEXT",
        "actor": agent_username,
        "details": f"Dispatched {ticket['ticket_number']} via {queue_source}",
        "ticket_id": ticket_id
    })

    return {
        "status": "success",
        "queue_source": queue_source,
        "ticket": ticket
    }


@app.get("/api/dsa/state")
async def get_dsa_state():
    """
    Returns full state of all 6 Data Structures for live visualizer studio:
      - Priority Heap tree & dynamic scores (with anti-starvation aging)
      - FIFO Queue ordered list
      - Circular Buffer ring indices & event stream
      - LRU Cache linked list order & hit/miss metrics
      - Task Graph DAG nodes & topological order
    """
    # Trigger age re-sorting
    priority_heap.reorder_aging()

    return {
        "priority_heap": {
            "size": len(priority_heap),
            "items": priority_heap.to_list(),
            "tree_array": priority_heap.get_heap_array_tree()
        },
        "fifo_queue": {
            "size": len(fifo_queue),
            "items": fifo_queue.to_list()
        },
        "lru_cache": lru_ticket_cache.get_stats(),
        "circular_buffer": circular_telemetry.to_dict(),
        "task_graph": remediation_dag.to_dict(),
        "system_time": time.time()
    }


@app.get("/api/dsa/search")
async def trie_search_api(q: str = Query("", min_length=1)):
    """Prefix search using Trie in O(L) time."""
    matched_ids = trie_search.search_prefix(q)
    results = []
    for tid in matched_ids[:10]:
        t = db.get_ticket_by_id(tid)
        if t:
            results.append(t)
    return {
        "query": q,
        "match_count": len(results),
        "tickets": results,
        "complexity": "O(L) Trie Prefix Traversal"
    }


@app.get("/api/metrics")
async def get_metrics():
    """Returns aggregated KPIs for the executive operations dashboard."""
    kpis = db.get_kpi_metrics()
    kpis["lru_cache_hit_rate"] = lru_ticket_cache.get_stats()["hit_ratio"]
    kpis["priority_queue_depth"] = len(priority_heap)
    kpis["standard_queue_depth"] = len(fifo_queue)
    return kpis


@app.post("/api/simulate-burst")
async def simulate_traffic_burst():
    """
    Simulates high-traffic burst of 5 diverse customer tickets.
    Immediately demonstrates the Priority Heap dynamic reordering,
    triage severity scoring, and ring buffer telemetry live on screen.
    """
    synthetic_payloads = [
        ("Cloud Database Disk Volume Out of Inodes", "Critical disk full alert on master node, write transactions aborted immediately!"),
        ("Checkout Payment Gateway SSL Handshake Failed", "Transactions dropping during authentication with payment processor gateway."),
        ("Dark Mode Toggle Button Misaligned in Safari", "A minor CSS margin glitch causes the toggle to shift 3px left."),
        ("User Account Password Reset Link Expired Too Fast", "Password reset tokens invalidate after 30 seconds instead of 15 minutes."),
        ("Request for Dark Grey Theme Variant", "Would be nice to have a softer grey background option for prolonged night sessions.")
    ]

    created = []
    for title, desc in synthetic_payloads:
        triage = triage_model.triage_ticket(title, desc)
        tier = "PRIORITY_HEAP" if triage["severity"] in ("CRITICAL", "HIGH") else "FIFO_STANDARD"
        
        tid = db.insert_ticket(
            title=title,
            description=desc,
            customer_id=1,
            customer_name="Alex Chen (Client)",
            priority_score=triage["priority_score"],
            severity=triage["severity"],
            category=triage["category"],
            queue_tier=tier,
            sla_hours=triage["sla_hours"]
        )
        t_obj = db.get_ticket_by_id(tid)
        if tier == "PRIORITY_HEAP":
            priority_heap.push(HeapNode(tid, triage["priority_score"], title, "Alex Chen (Client)", t_obj["created_at"], triage["severity"]))
        else:
            fifo_queue.enqueue(t_obj)

        trie_search.insert(title, tid)
        lru_ticket_cache.put(tid, t_obj)
        created.append(t_obj)

    circular_telemetry.append({
        "action": "TRAFFIC_SIMULATION",
        "actor": "Admin Simulator",
        "details": f"Injected 5 synthetic tickets across Priority Heap & FIFO Queue",
        "ticket_id": 0
    })

    return {"status": "success", "count": len(created), "tickets": created}


@app.get("/api/audit-logs")
async def get_audit_logs(limit: int = 40):
    """Fetches immutable audit logs from SQLite database."""
    logs = db.get_recent_audit_logs(limit=limit)
    return {"count": len(logs), "logs": logs}


@app.get("/api/analytics")
async def get_analytics():
    """Computes real-time distribution charts and SLA compliance for operations war-room."""
    tickets = db.get_all_tickets()
    now = time.time()
    
    # 1. Severity Distribution
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    # 2. Category Breakdown
    category_counts = {}
    # 3. Status Breakdown
    status_counts = {"QUEUED": 0, "CLAIMED": 0, "IN_PROGRESS": 0, "RESOLVED": 0}
    
    sla_on_time = 0
    sla_breached = 0

    for t in tickets:
        sev = t.get("severity", "MEDIUM")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1
        
        cat = t.get("category", "GENERAL")
        category_counts[cat] = category_counts.get(cat, 0) + 1
        
        st = t.get("status", "QUEUED")
        status_counts[st] = status_counts.get(st, 0) + 1
        
        # SLA calculation
        if st == "RESOLVED":
            if t["resolved_at"] and t["resolved_at"] <= t["sla_deadline"]:
                sla_on_time += 1
            else:
                sla_breached += 1
        else:
            if now > t["sla_deadline"]:
                sla_breached += 1
            else:
                sla_on_time += 1

    total_evaluated = sla_on_time + sla_breached
    compliance_rate = round((sla_on_time / total_evaluated * 100), 1) if total_evaluated > 0 else 100.0

    # Agent Workload
    agent_workload = [
        {"name": "Sarah Jenkins (Lead Agent)", "active_tickets": sum(1 for t in tickets if t["assigned_agent_name"] and "Sarah" in t["assigned_agent_name"] and t["status"] != "RESOLVED"), "role": "Senior L3 On-Call", "status": "ONLINE"},
        {"name": "Devin Vance (Security Specialist)", "active_tickets": sum(1 for t in tickets if t["category"] == "SECURITY" and t["status"] != "RESOLVED"), "role": "InfoSec Triage", "status": "ONLINE"},
        {"name": "Automated Dispatch Daemon", "active_tickets": len(priority_heap) + len(fifo_queue), "role": "In-Memory DSA Heap/Queue", "status": "ACTIVE"}
    ]

    return {
        "severity_distribution": severity_counts,
        "category_distribution": category_counts,
        "status_distribution": status_counts,
        "sla_compliance_rate": f"{compliance_rate}%",
        "sla_on_time_count": sla_on_time,
        "sla_breached_count": sla_breached,
        "agent_workloads": agent_workload
    }


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*70)
    print(" Meridian Â· OmniQueue Enterprise Ticketing & DSA Atelier (v2.0)")
    print(" Active URL: http://127.0.0.1:8000")
    print(" Documentation: http://127.0.0.1:8000/docs")
    print("="*70 + "\n")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
