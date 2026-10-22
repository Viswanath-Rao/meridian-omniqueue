"""
dsa_engine.py - Core Data Structures & Algorithms Engine
==========================================================
Implemented for Enterprise Ticket Orchestration:
  1. PriorityHeap (Max/Min Binary Heap with SLA aging) - O(log N)
  2. FIFOQueue (Double-ended linked structure) - O(1)
  3. CircularBuffer (Fixed-size Ring Buffer for telemetry & audit) - O(1)
  4. LRUCache (Doubly Linked List + Hash Map) - O(1)
  5. Trie (Prefix Search Tree for tags, customer names, categories) - O(L)
  6. TaskGraph (Directed Acyclic Graph with Kahn's Topological Sort) - O(V + E)
"""

import time
import heapq
from typing import Dict, List, Optional, Any, Tuple
from collections import deque

# =====================================================================
# 1. PRIORITY QUEUE / BINARY HEAP (Max-Heap with dynamic SLA aging)
# =====================================================================
class HeapNode:
    def __init__(self, ticket_id: int, base_score: float, title: str, customer: str, created_at: float, severity: str):
        self.ticket_id = ticket_id
        self.base_score = base_score      # AI Priority Score (1-100)
        self.title = title
        self.customer = customer
        self.created_at = created_at
        self.severity = severity          # CRITICAL, HIGH, MEDIUM, LOW

    def compute_dynamic_score(self, current_time: Optional[float] = None) -> float:
        """
        Anti-starvation aging algorithm:
        Score increases by +1.5 points for every minute spent waiting in queue.
        """
        now = current_time or time.time()
        wait_minutes = max(0.0, (now - self.created_at) / 60.0)
        # Severity multiplier
        sev_weight = {"CRITICAL": 1.5, "HIGH": 1.25, "MEDIUM": 1.0, "LOW": 0.8}.get(self.severity, 1.0)
        return round((self.base_score * sev_weight) + (wait_minutes * 1.5), 2)

    def to_dict(self, current_time: Optional[float] = None) -> dict:
        return {
            "ticket_id": self.ticket_id,
            "title": self.title,
            "customer": self.customer,
            "severity": self.severity,
            "base_score": self.base_score,
            "dynamic_score": self.compute_dynamic_score(current_time),
            "created_at": self.created_at,
            "wait_seconds": int(time.time() - self.created_at)
        }


class PriorityHeap:
    """
    Max-Heap tracking urgency. Highest dynamic priority score is served first.
    Internally uses negative tuples for Python's min-heap implementation.
    Time Complexity:
      - Push: O(log N)
      - Pop Max: O(log N)
      - Peek: O(1)
      - Rebuild / Aging: O(N)
    """
    def __init__(self):
        self._heap: List[Tuple[float, int, HeapNode]] = []
        self._counter = 0  # Tie-breaker

    def push(self, node: HeapNode) -> None:
        self._counter += 1
        score = node.compute_dynamic_score()
        # Invert score so largest score is popped first (Max-Heap)
        heapq.heappush(self._heap, (-score, self._counter, node))

    def pop(self) -> Optional[HeapNode]:
        if not self._heap:
            return None
        _, _, node = heapq.heappop(self._heap)
        return node

    def peek(self) -> Optional[HeapNode]:
        if not self._heap:
            return None
        return self._heap[0][2]

    def remove(self, ticket_id: int) -> bool:
        """Remove a specific ticket if claimed or cancelled."""
        idx = -1
        for i, (_, _, node) in enumerate(self._heap):
            if node.ticket_id == ticket_id:
                idx = i
                break
        if idx != -1:
            self._heap.pop(idx)
            heapq.heapify(self._heap)
            return True
        return False

    def reorder_aging(self) -> None:
        """Re-heapify based on updated elapsed waiting time (Aging)."""
        now = time.time()
        new_heap = []
        for _, count, node in self._heap:
            score = node.compute_dynamic_score(now)
            new_heap.append((-score, count, node))
        heapq.heapify(new_heap)
        self._heap = new_heap

    def to_list(self) -> List[dict]:
        now = time.time()
        # Return sorted by dynamic priority descending
        sorted_nodes = sorted([node for _, _, node in self._heap], key=lambda n: n.compute_dynamic_score(now), reverse=True)
        return [n.to_dict(now) for n in sorted_nodes]

    def get_heap_array_tree(self) -> List[dict]:
        """Returns the raw binary heap array for tree visualization."""
        now = time.time()
        tree_repr = []
        for idx, (inv_score, _, node) in enumerate(self._heap):
            tree_repr.append({
                "index": idx,
                "ticket_id": node.ticket_id,
                "title": node.title,
                "severity": node.severity,
                "dynamic_score": round(-inv_score, 2),
                "parent_idx": (idx - 1) // 2 if idx > 0 else None,
                "left_child_idx": (2 * idx + 1) if (2 * idx + 1) < len(self._heap) else None,
                "right_child_idx": (2 * idx + 2) if (2 * idx + 2) < len(self._heap) else None,
            })
        return tree_repr

    def __len__(self) -> int:
        return len(self._heap)


# =====================================================================
# 2. FIFO QUEUE (First-In, First-Out Queue for Standard Support)
# =====================================================================
class FIFOQueue:
    """
    Standard FIFO Queue for standard tickets.
    Time Complexity:
      - Enqueue: O(1)
      - Dequeue: O(1)
      - Peek: O(1)
    """
    def __init__(self):
        self._queue = deque()

    def enqueue(self, item: dict) -> None:
        self._queue.append(item)

    def dequeue(self) -> Optional[dict]:
        if not self._queue:
            return None
        return self._queue.popleft()

    def peek(self) -> Optional[dict]:
        return self._queue[0] if self._queue else None

    def remove(self, ticket_id: int) -> bool:
        for idx, item in enumerate(self._queue):
            if item.get("ticket_id") == ticket_id:
                del self._queue[idx]
                return True
        return False

    def to_list(self) -> List[dict]:
        return list(self._queue)

    def __len__(self) -> int:
        return len(self._queue)


# =====================================================================
# 3. CIRCULAR BUFFER (Fixed-size Ring Buffer for Audit & Telemetry)
# =====================================================================
class CircularBuffer:
    """
    Fixed-capacity circular array to store the most recent events and metrics.
    Prevents memory leaks from unbounded event logging.
    Time Complexity:
      - Append: O(1)
      - Read All: O(K) where K is capacity
    """
    def __init__(self, capacity: int = 50):
        self.capacity = capacity
        self.buffer = [None] * capacity
        self.head = 0  # oldest
        self.tail = 0  # next write position
        self.size = 0

    def append(self, event: dict) -> None:
        event_with_ts = dict(event)
        if "timestamp" not in event_with_ts:
            event_with_ts["timestamp"] = time.strftime("%H:%M:%S")
        
        self.buffer[self.tail] = event_with_ts
        self.tail = (self.tail + 1) % self.capacity
        if self.size < self.capacity:
            self.size += 1
        else:
            # Overwrote oldest item, advance head
            self.head = (self.head + 1) % self.capacity

    def get_all(self) -> List[dict]:
        """Returns items in chronological order (oldest to newest)."""
        items = []
        for i in range(self.size):
            idx = (self.head + i) % self.capacity
            items.append(self.buffer[idx])
        return items

    def to_dict(self) -> dict:
        return {
            "capacity": self.capacity,
            "current_size": self.size,
            "head_index": self.head,
            "tail_index": self.tail,
            "events": self.get_all()[::-1]  # Latest first for UI
        }


# =====================================================================
# 4. LRU CACHE (Doubly Linked List + Hash Map)
# =====================================================================
class DListNode:
    def __init__(self, key: Any = None, value: Any = None):
        self.key = key
        self.value = value
        self.prev: Optional['DListNode'] = None
        self.next: Optional['DListNode'] = None


class LRUCache:
    """
    Least Recently Used (LRU) Cache for fast ticket lookups.
    Uses Doubly Linked List with Sentinel Head & Tail + Hash Map.
    Time Complexity:
      - Get: O(1)
      - Put: O(1)
      - Eviction: O(1)
    """
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.cache: Dict[Any, DListNode] = {}
        # Sentinel nodes
        self.head = DListNode()
        self.tail = DListNode()
        self.head.next = self.tail
        self.tail.prev = self.head

        # Telemetry
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def _add_node(self, node: DListNode):
        """Always add immediately after head (Most Recently Used)."""
        node.prev = self.head
        node.next = self.head.next
        self.head.next.prev = node
        self.head.next = node

    def _remove_node(self, node: DListNode):
        """Remove an existing node from the linked list."""
        prev_node = node.prev
        next_node = node.next
        if prev_node and next_node:
            prev_node.next = next_node
            next_node.prev = prev_node

    def _move_to_head(self, node: DListNode):
        """Move accessed node to head."""
        self._remove_node(node)
        self._add_node(node)

    def _pop_tail(self) -> DListNode:
        """Pop the least recently used node right before tail sentinel."""
        lru_node = self.tail.prev
        self._remove_node(lru_node)
        return lru_node

    def get(self, key: Any) -> Optional[Any]:
        if key in self.cache:
            node = self.cache[key]
            self._move_to_head(node)
            self.hits += 1
            return node.value
        self.misses += 1
        return None

    def put(self, key: Any, value: Any) -> Optional[Any]:
        evicted_key = None
        if key in self.cache:
            node = self.cache[key]
            node.value = value
            self._move_to_head(node)
        else:
            new_node = DListNode(key, value)
            self.cache[key] = new_node
            self._add_node(new_node)
            if len(self.cache) > self.capacity:
                tail = self._pop_tail()
                del self.cache[tail.key]
                self.evictions += 1
                evicted_key = tail.key
        return evicted_key

    def invalidate(self, key: Any) -> bool:
        if key in self.cache:
            node = self.cache[key]
            self._remove_node(node)
            del self.cache[key]
            return True
        return False

    def to_list(self) -> List[dict]:
        """Returns nodes in MRU -> LRU order."""
        res = []
        curr = self.head.next
        while curr and curr != self.tail:
            res.append({"key": curr.key, "value": curr.value})
            curr = curr.next
        return res

    def get_stats(self) -> dict:
        total = self.hits + self.misses
        ratio = round((self.hits / total * 100), 1) if total > 0 else 0.0
        return {
            "capacity": self.capacity,
            "size": len(self.cache),
            "hits": self.hits,
            "misses": self.misses,
            "hit_ratio": f"{ratio}%",
            "evictions": self.evictions,
            "items": self.to_list()
        }


# =====================================================================
# 5. TRIE (Prefix Search Tree for Fast Autocomplete)
# =====================================================================
class TrieNode:
    def __init__(self):
        self.children: Dict[str, 'TrieNode'] = {}
        self.is_end_of_word = False
        self.ticket_ids: List[int] = []


class Trie:
    """
    Prefix Tree for instant ticket search by keywords, categories, and customer names.
    Time Complexity:
      - Insert: O(L) where L is string length
      - Search Prefix: O(P + K) where P is prefix length, K is matches
    """
    def __init__(self):
        self.root = TrieNode()

    def insert(self, phrase: str, ticket_id: int):
        words = phrase.lower().split()
        for word in words:
            # Clean non-alphanumeric
            clean = "".join(ch for ch in word if ch.isalnum())
            if not clean:
                continue
            curr = self.root
            for ch in clean:
                if ch not in curr.children:
                    curr.children[ch] = TrieNode()
                curr = curr.children[ch]
                if ticket_id not in curr.ticket_ids:
                    curr.ticket_ids.append(ticket_id)
            curr.is_end_of_word = True

    def search_prefix(self, prefix: str) -> List[int]:
        clean = "".join(ch for ch in prefix.lower() if ch.isalnum())
        if not clean:
            return []
        curr = self.root
        for ch in clean:
            if ch not in curr.children:
                return []
            curr = curr.children[ch]
        return curr.ticket_ids


# =====================================================================
# 6. TASK GRAPH (Directed Acyclic Graph for Subtask Dependencies)
# =====================================================================
class TaskGraph:
    """
    DAG representing incident remediation workflows with dependency ordering.
    E.g. Database incident requires:
      1. Isolate replica
      2. Restart master DB
      3. Rebuild indexes
      4. Notify users
    Uses Kahn's Algorithm for Topological Sort & Cycle Detection.
    Time Complexity:
      - Topological Sort: O(V + E)
      - Dependency Check: O(1)
    """
    def __init__(self):
        self.adj: Dict[str, List[str]] = {}
        self.in_degree: Dict[str, int] = {}
        self.node_status: Dict[str, str] = {}  # PENDING, IN_PROGRESS, COMPLETED

    def add_node(self, task_id: str, label: str):
        if task_id not in self.adj:
            self.adj[task_id] = []
            self.in_degree[task_id] = 0
            self.node_status[task_id] = "PENDING"

    def add_dependency(self, prerequisite: str, dependent: str):
        """Prerequisite must finish BEFORE Dependent can start."""
        self.add_node(prerequisite, prerequisite)
        self.add_node(dependent, dependent)
        self.adj[prerequisite].append(dependent)
        self.in_degree[dependent] = self.in_degree.get(dependent, 0) + 1

    def topological_sort(self) -> Tuple[List[str], bool]:
        """
        Kahn's Algorithm for Topological Ordering.
        Returns (ordered_tasks, has_cycle)
        """
        in_deg = dict(self.in_degree)
        queue = deque([node for node, deg in in_deg.items() if deg == 0])
        order = []

        while queue:
            u = queue.popleft()
            order.append(u)
            for v in self.adj.get(u, []):
                in_deg[v] -= 1
                if in_deg[v] == 0:
                    queue.append(v)

        has_cycle = len(order) != len(self.adj)
        return order, has_cycle

    def can_execute(self, task_id: str) -> bool:
        """A task can execute only if all its incoming prerequisite nodes are COMPLETED."""
        for u, dependents in self.adj.items():
            if task_id in dependents:
                if self.node_status.get(u) != "COMPLETED":
                    return False
        return True

    def mark_completed(self, task_id: str):
        if task_id in self.node_status:
            self.node_status[task_id] = "COMPLETED"

    def to_dict(self) -> dict:
        nodes = []
        for task_id, status in self.node_status.items():
            nodes.append({
                "id": task_id,
                "status": status,
                "can_start": self.can_execute(task_id),
                "in_degree": self.in_degree.get(task_id, 0)
            })
        edges = []
        for u, neighbors in self.adj.items():
            for v in neighbors:
                edges.append({"from": u, "to": v})
        
        order, has_cycle = self.topological_sort()
        return {
            "nodes": nodes,
            "edges": edges,
            "topological_order": order,
            "has_cycle": has_cycle
        }
