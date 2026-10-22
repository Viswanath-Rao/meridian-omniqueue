"""
database.py - SQLite SQL Persistence & RBAC Schema
====================================================
Implements:
  - Strict SQL DDL schema with foreign keys, indexes, and constraints
  - RBAC Users (CUSTOMER, AGENT, ADMIN)
  - Ticket lifecycle tracking & SLA timestamps
  - Subtask dependency relationships
  - Audit log table with query history
  - Realistic seed generator for instant testing
"""

import sqlite3
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "tickets_system.db")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(force_reseed: bool = False):
    """Initializes the database schema and seeds initial data."""
    if force_reseed and os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
        except Exception:
            pass

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users & RBAC Roles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('CUSTOMER', 'AGENT', 'ADMIN')),
        email TEXT,
        full_name TEXT NOT NULL,
        avatar_color TEXT DEFAULT '#d4b483',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Tickets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        customer_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        assigned_agent_id INTEGER,
        assigned_agent_name TEXT,
        status TEXT NOT NULL CHECK(status IN ('QUEUED', 'CLAIMED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')),
        priority_score REAL NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
        category TEXT NOT NULL,
        queue_tier TEXT NOT NULL CHECK(queue_tier IN ('PRIORITY_HEAP', 'FIFO_STANDARD')),
        created_at REAL NOT NULL,
        sla_hours INTEGER NOT NULL DEFAULT 12,
        sla_deadline REAL NOT NULL,
        resolved_at REAL,
        resolution_notes TEXT,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 3. Ticket Dependencies (DAG Edges)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ticket_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prerequisite_ticket_id INTEGER NOT NULL,
        dependent_ticket_id INTEGER NOT NULL,
        FOREIGN KEY (prerequisite_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (dependent_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );
    """)

    # 4. Audit Trail Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_username TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        ticket_id INTEGER,
        details TEXT,
        timestamp REAL NOT NULL
    );
    """)

    # Indexes for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority_score);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_tier ON tickets(queue_tier);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);")

    conn.commit()

    # Check if seed data needed
    cursor.execute("SELECT COUNT(*) as cnt FROM users;")
    if cursor.fetchone()["cnt"] == 0:
        seed_data(conn)

    conn.close()


def seed_data(conn: sqlite3.Connection):
    """Seeds realistic enterprise users, tickets, and logs."""
    cursor = conn.cursor()
    now = time.time()

    # Default RBAC Users
    users = [
        ("alex_customer", "CUSTOMER", "alex@enterprise.io", "Alex Chen (Client)", "#6fbfb0"),
        ("sarah_agent", "AGENT", "sarah@support.net", "Sarah Jenkins (Lead Agent)", "#d4b483"),
        ("viswa_admin", "ADMIN", "viswa@system.io", "Viswa (System Ops Lead)", "#e07a5f"),
    ]
    cursor.executemany("""
    INSERT INTO users (username, role, email, full_name, avatar_color)
    VALUES (?, ?, ?, ?, ?);
    """, users)

    # Seed Initial Tickets
    initial_tickets = [
        (
            "TCK-1001",
            "Production Database Connection Pool Exhausted",
            "High connection spike causing HTTP 500 across checkout API. Database threads locked and queries timing out.",
            1, "Alex Chen (Client)", None, None,
            "QUEUED", 92.5, "CRITICAL", "INFRASTRUCTURE", "PRIORITY_HEAP",
            now - 1800, 1, now + 1800, None, None
        ),
        (
            "TCK-1002",
            "Potential Security Breach: Unauthorized Token Influx",
            "Suspicious IP range hitting admin endpoints with brute-force API authentication attempts.",
            1, "Alex Chen (Client)", None, None,
            "QUEUED", 88.0, "CRITICAL", "SECURITY", "PRIORITY_HEAP",
            now - 1200, 1, now + 2400, None, None
        ),
        (
            "TCK-1003",
            "Stripe Double Billing Webhook Duplicate Charge",
            "Customers reported being charged twice on annual plan invoice #INV-4921.",
            1, "Alex Chen (Client)", None, None,
            "QUEUED", 64.0, "HIGH", "BILLING", "PRIORITY_HEAP",
            now - 900, 4, now + 13500, None, None
        ),
        (
            "TCK-1004",
            "CSV Export Button Missing Date Range Filter",
            "Customer reports the reports tab exports all historical rows instead of respecting the Q3 filter.",
            1, "Alex Chen (Client)", None, None,
            "QUEUED", 32.0, "MEDIUM", "APPLICATION_BUG", "FIFO_STANDARD",
            now - 600, 12, now + 42600, None, None
        ),
        (
            "TCK-1005",
            "Dark Mode Font Contrast in Settings Panel",
            "Labels on toggle switch have low contrast on dark theme browsers.",
            1, "Alex Chen (Client)", None, None,
            "QUEUED", 18.0, "LOW", "APPLICATION_BUG", "FIFO_STANDARD",
            now - 300, 48, now + 172500, None, None
        ),
        (
            "TCK-1006",
            "Feature Request: Webhook Notification for Slack",
            "Would like to receive real-time ticket escalation alerts in team channel.",
            1, "Alex Chen (Client)", None, None,
            "QUEUED", 22.0, "LOW", "FEATURE_REQUEST", "FIFO_STANDARD",
            now - 150, 48, now + 172650, None, None
        )
    ]

    cursor.executemany("""
    INSERT INTO tickets (
        ticket_number, title, description, customer_id, customer_name,
        assigned_agent_id, assigned_agent_name, status, priority_score,
        severity, category, queue_tier, created_at, sla_hours,
        sla_deadline, resolved_at, resolution_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, initial_tickets)

    # Initial Audit Trail
    audit_events = [
        ("system", "ADMIN", "SYSTEM_BOOTSTRAP", 0, "Database initialized with RBAC schema & seed workloads", now - 2000),
        ("alex_customer", "CUSTOMER", "CREATE_TICKET", 1, "Submitted TCK-1001 with Critical Outage payload", now - 1800),
        ("alex_customer", "CUSTOMER", "CREATE_TICKET", 2, "Submitted TCK-1002 with Security alert", now - 1200),
        ("ai_triage", "ADMIN", "AI_TRIAGE_RUN", 1, "Classified TCK-1001 as CRITICAL (Score 92.5) -> Enqueued into PriorityHeap", now - 1790),
    ]

    cursor.executemany("""
    INSERT INTO audit_logs (actor_username, actor_role, action, ticket_id, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?);
    """, audit_events)

    conn.commit()


# =====================================================================
# SQL Data Access Methods
# =====================================================================
def get_all_tickets() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM tickets 
        ORDER BY 
            CASE status 
                WHEN 'CLAIMED' THEN 1
                WHEN 'IN_PROGRESS' THEN 2
                WHEN 'QUEUED' THEN 3
                WHEN 'RESOLVED' THEN 4
                ELSE 5
            END,
            priority_score DESC, 
            created_at ASC;
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_ticket_by_id(ticket_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tickets WHERE id = ?;", (ticket_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def insert_ticket(
    title: str, description: str, customer_id: int, customer_name: str,
    priority_score: float, severity: str, category: str, queue_tier: str,
    sla_hours: int
) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = time.time()
    deadline = now + (sla_hours * 3600)
    
    # Generate unique ticket number
    cursor.execute("SELECT COUNT(*) as cnt FROM tickets;")
    cnt = cursor.fetchone()["cnt"] + 1001
    ticket_number = f"TCK-{cnt}"

    cursor.execute("""
    INSERT INTO tickets (
        ticket_number, title, description, customer_id, customer_name,
        status, priority_score, severity, category, queue_tier,
        created_at, sla_hours, sla_deadline
    ) VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, ?, ?, ?);
    """, (
        ticket_number, title, description, customer_id, customer_name,
        priority_score, severity, category, queue_tier, now, sla_hours, deadline
    ))
    ticket_id = cursor.lastrowid

    # Log to audit trail
    cursor.execute("""
    INSERT INTO audit_logs (actor_username, actor_role, action, ticket_id, details, timestamp)
    VALUES (?, 'CUSTOMER', 'CREATE_TICKET', ?, ?, ?);
    """, (customer_name, ticket_id, f"Created {ticket_number}: {title} (Tier: {queue_tier})", now))

    conn.commit()
    conn.close()
    return ticket_id

def update_ticket_status(
    ticket_id: int, status: str, actor_username: str, actor_role: str,
    agent_id: Optional[int] = None, agent_name: Optional[str] = None,
    resolution_notes: Optional[str] = None
) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = time.time()

    resolved_at = now if status == "RESOLVED" else None

    cursor.execute("""
    UPDATE tickets 
    SET status = ?, 
        assigned_agent_id = COALESCE(?, assigned_agent_id),
        assigned_agent_name = COALESCE(?, assigned_agent_name),
        resolved_at = COALESCE(?, resolved_at),
        resolution_notes = COALESCE(?, resolution_notes)
    WHERE id = ?;
    """, (status, agent_id, agent_name, resolved_at, resolution_notes, ticket_id))

    cursor.execute("""
    INSERT INTO audit_logs (actor_username, actor_role, action, ticket_id, details, timestamp)
    VALUES (?, ?, 'STATUS_UPDATE', ?, ?, ?);
    """, (actor_username, actor_role, ticket_id, f"Status updated to '{status}' by {actor_username}", now))

    conn.commit()
    updated = cursor.rowcount > 0
    conn.close()
    return updated

def get_kpi_metrics() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = time.time()

    cursor.execute("SELECT COUNT(*) as total FROM tickets;")
    total = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as active FROM tickets WHERE status IN ('QUEUED', 'CLAIMED', 'IN_PROGRESS');")
    active = cursor.fetchone()["active"]

    cursor.execute("SELECT COUNT(*) as critical FROM tickets WHERE severity = 'CRITICAL' AND status != 'RESOLVED';")
    critical = cursor.fetchone()["critical"]

    cursor.execute("SELECT COUNT(*) as resolved FROM tickets WHERE status = 'RESOLVED';")
    resolved = cursor.fetchone()["resolved"]

    cursor.execute("SELECT COUNT(*) as breached FROM tickets WHERE sla_deadline < ? AND status != 'RESOLVED';", (now,))
    breached = cursor.fetchone()["breached"]

    cursor.execute("SELECT AVG(priority_score) as avg_score FROM tickets WHERE status != 'RESOLVED';")
    avg_score = cursor.fetchone()["avg_score"] or 0.0

    conn.close()
    return {
        "total_tickets": total,
        "active_queue_count": active,
        "critical_outages": critical,
        "resolved_count": resolved,
        "sla_breaches": breached,
        "avg_priority_score": round(avg_score, 1)
    }

def get_recent_audit_logs(limit: int = 30) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?;", (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows
