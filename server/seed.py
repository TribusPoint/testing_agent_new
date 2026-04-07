"""
Seed script — populates the testing_agent database with realistic sample data.

Usage (from server/ directory, with venv active):
    python seed.py

Options:
    python seed.py --clear   # wipe all seeded tables first, then re-seed
    python seed.py --help

Requires: psycopg2-binary, python-dotenv
"""

import sys
import uuid
import hashlib
import json
import argparse
from datetime import datetime, timedelta, timezone

import psycopg2
from psycopg2.extras import execute_values

# ── Load DATABASE_URL_SYNC from .env ─────────────────────────────────────────
try:
    from dotenv import load_dotenv
    import os
    load_dotenv(".env")
    DB_URL = os.environ["DATABASE_URL_SYNC"]
except Exception as e:
    print(f"[seed] Could not load DATABASE_URL_SYNC from .env: {e}")
    sys.exit(1)


# ── Helpers ───────────────────────────────────────────────────────────────────

def uid() -> str:
    return str(uuid.uuid4())

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()

def now(offset_days: int = 0) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=offset_days)

def dsn_from_url(url: str) -> str:
    """Convert SQLAlchemy URL to psycopg2 DSN (strip the driver prefix)."""
    # postgresql+psycopg2://user:pass@host:port/db  →  host=... dbname=...
    url = url.replace("postgresql+psycopg2://", "postgresql://")
    return url


# ── IDs (fixed so FK references work across tables) ──────────────────────────

# Connections
conn_sf1   = uid()
conn_sf2   = uid()
conn_sf3   = uid()
conn_http1 = uid()
conn_brow1 = uid()

# Agents (one per connection)
agt_sf1   = uid()
agt_sf2   = uid()
agt_sf3   = uid()
agt_http1 = uid()
agt_brow1 = uid()

# Projects
proj1 = uid()
proj2 = uid()
proj3 = uid()
proj4 = uid()
proj5 = uid()

# Dimensions
dim1 = uid()
dim2 = uid()
dim3 = uid()
dim4 = uid()
dim5 = uid()

# Test runs
run1 = uid()
run2 = uid()
run3 = uid()
run4 = uid()
run5 = uid()

# Questions
q1 = uid(); q2 = uid(); q3 = uid(); q4 = uid(); q5 = uid()
q6 = uid(); q7 = uid(); q8 = uid(); q9 = uid(); q10 = uid()

# Personas (fixed IDs for question FK strings)
per_john = uid()


# ── Seed data ─────────────────────────────────────────────────────────────────

CONNECTIONS = [
    (conn_sf1,  "Acme Health — Salesforce",      "salesforce", "acmehealth.my.salesforce.com",   "3MVG9..KEY1", "SECRET1", None, None),
    (conn_sf2,  "FinFirst Advisory — Salesforce", "salesforce", "finfirst.my.salesforce.com",     "3MVG9..KEY2", "SECRET2", None, None),
    (conn_sf3,  "MediCare Support — Salesforce",  "salesforce", "medicare.my.salesforce.com",     "3MVG9..KEY3", "SECRET3", None, None),
    (conn_http1,"RetailMax API",                  "http",       "",                               "",            "",        None,
        json.dumps({"auth_type": "bearer", "auth_value": "tok_rm_demo", "test_url": "https://api.retailmax.io/health"})),
    (conn_brow1,"Cleveland Clinic Chat Widget",   "browser",    "",                               "",            "",        None,
        json.dumps({"url": "https://my.clevelandclinic.org/", "input_selector": "#chat-input",
                    "send_selector": "#chat-send", "response_selector": ".chat-bubble",
                    "iframe_selector": "", "wait_after_send_ms": 5000, "load_wait_ms": 2000})),
]

AGENTS = [
    # id, connection_id, salesforce_id, name, developer_name, agent_type, config
    (agt_sf1,   conn_sf1,   "0HoAA000000acme1AAA", "Acme Health Assistant",    "Acme_Health_Assistant",    "salesforce", None),
    (agt_sf2,   conn_sf2,   "0HoAA000000fin1BAAA", "FinFirst AI Advisor",      "FinFirst_AI_Advisor",      "salesforce", None),
    (agt_sf3,   conn_sf3,   "0HoAA000000med1CAAA", "MediCare Support Bot",     "MediCare_Support_Bot",     "salesforce", None),
    (agt_http1, conn_http1, "retailmax-api-bot",   "RetailMax Product Bot",    "RetailMax_Product_Bot",    "http",
        json.dumps({"endpoint": "https://api.retailmax.io/chat", "method": "POST",
                    "body_template": '{"message": "{{question}}"}',
                    "response_path": "reply", "auth_type": "bearer", "auth_value": "tok_rm_demo"})),
    (agt_brow1, conn_brow1, "cc-browser-bot",      "Cleveland Clinic Chat Bot","Cleveland_Clinic_Chat_Bot","browser",
        json.dumps({"url": "https://my.clevelandclinic.org/", "input_selector": "#chat-input",
                    "send_selector": "#chat-send", "response_selector": ".chat-bubble",
                    "iframe_selector": "", "wait_after_send_ms": 5000, "load_wait_ms": 2000})),
]

PROJECTS = [
    # id, name, description, company_name, company_websites, industry, competitors
    (proj1, "Q1 Healthcare Chatbot QA",
     "Quarterly regression suite for Acme Health's patient-facing AI agent.",
     "Acme Health", "acmehealth.com", "Healthcare",
     "Epic MyChart, Kaiser Permanente, Teladoc"),

    (proj2, "Financial Advisory Bot Validation",
     "Evaluate accuracy and compliance of the FinFirst AI advisor across 5 product lines.",
     "FinFirst Advisory", "finfirst.com", "Financial Services",
     "Betterment, Wealthfront, Fidelity Go"),

    (proj3, "Patient Support Regression",
     "MediCare support agent regression testing after each model update.",
     "MediCare", "medicare.gov", "Healthcare",
     "UnitedHealth, Cigna, Anthem"),

    (proj4, "RetailMax Product Discovery Testing",
     "Test product recommendation and FAQ accuracy for the RetailMax API bot.",
     "RetailMax", "retailmax.io", "E-Commerce",
     "Shopify Chat, Amazon Rufus, Intercom"),

    (proj5, "Cleveland Clinic Web Widget Evaluation",
     "Browser-based testing of the Cleveland Clinic homepage chat widget.",
     "Cleveland Clinic", "my.clevelandclinic.org", "Healthcare",
     "Mayo Clinic, Johns Hopkins, WebMD"),
]

PROJECT_AGENTS = [
    (uid(), proj1, agt_sf1),
    (uid(), proj2, agt_sf2),
    (uid(), proj3, agt_sf3),
    (uid(), proj4, agt_http1),
    (uid(), proj5, agt_brow1),
]

# Personas: name, description (= Persona line), tag, goal, personality, knowledge_level
PERSONAS = [
    (
        per_john,
        proj1,
        agt_sf1,
        "John Stevenson",
        "Teacher",
        "external",
        "Get course details and fees",
        "Calm and persistent in nature",
        "Good",
    ),
    (
        uid(),
        proj2,
        agt_sf2,
        "Retail Investor",
        "Individual with basic investment knowledge.",
        "external",
        "Understand fees, risks, and account options before committing money.",
        "Analytical and patient; asks follow-up questions.",
        "Good",
    ),
    (
        uid(),
        proj3,
        agt_sf3,
        "Care Coordinator",
        "Internal nurse coordinating patient care.",
        "internal",
        "Resolve delays, prior auths, and handoffs quickly for patients.",
        "Direct and efficient under pressure.",
        "Expert",
    ),
    (
        uid(),
        proj4,
        agt_http1,
        "Bargain Hunter",
        "Price-sensitive shopper looking for deals.",
        "external",
        "Find the best price and return policy before buying.",
        "Impulsive but compares options when prompted.",
        "Beginner",
    ),
    (
        uid(),
        proj5,
        agt_brow1,
        "Returning Patient",
        "Existing Cleveland Clinic patient seeking follow-up.",
        "external",
        "Book or change appointments and understand next steps.",
        "Methodical; reads instructions carefully.",
        "Good",
    ),
]

DIMENSIONS = [
    # id, project_id, name
    (dim1, proj1, "Topic Complexity"),
    (dim2, proj2, "Risk Tolerance"),
    (dim3, proj3, "Urgency Level"),
    (dim4, proj4, "Product Category"),
    (dim5, proj5, "Appointment Type"),
]

DIMENSION_VALUES = [
    # id, dimension_id, name, description
    (uid(), dim1, "Basic",    "Simple, single-step questions a layperson would ask."),
    (uid(), dim1, "Clinical", "Multi-step clinical queries requiring domain knowledge."),
    (uid(), dim1, "Billing",  "Questions about insurance, costs, and billing codes."),

    (uid(), dim2, "Conservative", "Prefers low-risk, capital-preservation strategies."),
    (uid(), dim2, "Moderate",     "Balanced risk-return approach."),
    (uid(), dim2, "Aggressive",   "High-growth, high-risk tolerance."),

    (uid(), dim3, "Routine",   "Non-urgent, informational queries."),
    (uid(), dim3, "Urgent",    "Time-sensitive medical or administrative issues."),
    (uid(), dim3, "Emergency", "Immediate action required."),

    (uid(), dim4, "Electronics", "Laptops, phones, accessories."),
    (uid(), dim4, "Apparel",     "Clothing and footwear."),
    (uid(), dim4, "Home",        "Furniture and home goods."),

    (uid(), dim5, "New Appointment",    "Scheduling a first visit."),
    (uid(), dim5, "Follow-Up",          "Returning for a follow-up consultation."),
    (uid(), dim5, "Specialist Referral","Request to see a specialist."),
]

PERSONALITY_PROFILES = [
    # id, project_id, name, description
    (uid(), proj1, "Anxious",       "Patient with health anxiety; needs reassurance and clear language."),
    (uid(), proj2, "Analytical",    "Investor who demands data, charts, and detailed explanations."),
    (uid(), proj3, "Direct",        "Coordinator who wants fast, actionable responses with no fluff."),
    (uid(), proj4, "Impulsive",     "Shopper who buys quickly and asks questions after."),
    (uid(), proj5, "Methodical",    "Patient who reads every detail before making decisions."),
]

QUESTIONS = [
    # id, project_id, agent_id, question, expected_answer, persona, dimension, dimension_value, personality_profile
    (q1, proj1, agt_sf1,
     "How do I request a prescription refill through the patient portal?",
     "Log in to MyChart, navigate to Medications, select the prescription, and click Request Refill. Your provider will be notified within 1 business day.",
     "John Stevenson", "Topic Complexity", "Basic", "Anxious"),

    (q2, proj1, agt_sf1,
     "What are the symptoms of diabetic ketoacidosis and when should I go to the ER?",
     "DKA symptoms include excessive thirst, frequent urination, nausea, abdominal pain, and fruity-smelling breath. Go to the ER immediately if blood glucose exceeds 300 mg/dL or you feel confused.",
     "John Stevenson", "Topic Complexity", "Clinical", "Anxious"),

    (q3, proj2, agt_sf2,
     "What is the difference between a Roth IRA and a Traditional IRA?",
     "A Traditional IRA uses pre-tax contributions (tax deduction now, taxed on withdrawal). A Roth IRA uses after-tax contributions (no deduction now, tax-free growth and withdrawal in retirement).",
     "Retail Investor", "Risk Tolerance", "Conservative", "Analytical"),

    (q4, proj3, agt_sf3,
     "A patient's discharge is delayed due to pending lab results. What are my options?",
     "You can flag the case as high priority in the portal, contact the lab directly via the internal hotline, or escalate to the attending physician for a conditional discharge order.",
     "Care Coordinator", "Urgency Level", "Urgent", "Direct"),

    (q5, proj4, agt_http1,
     "Do you have any noise-cancelling headphones under $150?",
     "Yes, we carry the Sony WH-CH720N at $99.99 and the Anker Soundcore Q45 at $79.99, both with active noise cancellation.",
     "Bargain Hunter", "Product Category", "Electronics", "Impulsive"),

    (q6, proj5, agt_brow1,
     "How do I schedule a follow-up appointment with my cardiologist?",
     "Log in to MyClevelandClinic, go to Appointments, select Schedule an Appointment, choose Cardiology, and pick your provider and a time slot.",
     "Returning Patient", "Appointment Type", "Follow-Up", "Methodical"),

    (q7, proj1, agt_sf1,
     "What vaccines are recommended for adults over 50?",
     "Recommended vaccines include flu (annual), COVID-19 booster, shingles (Shingrix, 2 doses), pneumococcal (PPSV23 or PCV15/20), and Tdap if not received recently.",
     "John Stevenson", "Topic Complexity", "Basic", "Anxious"),

    (q8, proj2, agt_sf2,
     "Can I roll over my 401(k) from a previous employer into my current plan?",
     "Yes, you can roll over a 401(k) via a direct rollover to avoid taxes and penalties. Contact your current plan administrator and request a rollover form. The process typically takes 2–4 weeks.",
     "Retail Investor", "Risk Tolerance", "Moderate", "Analytical"),

    (q9, proj3, agt_sf3,
     "How do I submit a prior authorization request for a specialist referral?",
     "Navigate to Clinical Workflows → Prior Authorization, enter the patient's insurance ID, select the specialist type, attach the referral note, and submit. Most insurers respond within 48 hours.",
     "Care Coordinator", "Urgency Level", "Routine", "Direct"),

    (q10, proj4, agt_http1,
     "What is your return policy for electronics?",
     "Electronics can be returned within 30 days of purchase in original packaging. Items must be unused and include all accessories. Refunds are processed within 5–7 business days.",
     "Bargain Hunter", "Product Category", "Electronics", "Impulsive"),
]

TEST_RUNS = [
    # id, project_id, agent_id, status, total_q, completed_q, started_at, completed_at
    (run1, proj1, agt_sf1,   "completed", 5, 5,  now(-7), now(-7) + timedelta(minutes=12)),
    (run2, proj2, agt_sf2,   "completed", 5, 5,  now(-3), now(-3) + timedelta(minutes=9)),
    (run3, proj3, agt_sf3,   "completed", 5, 5,  now(-1), now(-1) + timedelta(minutes=15)),
    (run4, proj4, agt_http1, "running",   5, 3,  now(0),  None),
    (run5, proj5, agt_brow1, "pending",   5, 0,  None,    None),
]

TEST_RUN_RESULTS = [
    # id, run_id, question_id, question_text, response_text, follow_up_utterances, latency_ms, answered, score, evaluation_notes, status
    (uid(), run1, q1,
     "How do I request a prescription refill through the patient portal?",
     "To request a refill, log in to MyChart, go to the Medications tab, find your prescription and hit Request Refill. Your care team will review it within one business day.",
     json.dumps([]),
     1820, True, 92,
     "Response accurate and covers all required steps. Tone is appropriately reassuring. Minor omission: did not mention refill eligibility timing.",
     "completed"),

    (uid(), run1, q2,
     "What are the symptoms of diabetic ketoacidosis and when should I go to the ER?",
     "DKA symptoms include high blood sugar, fruity breath, nausea, and fatigue. You should go to the ER if your blood sugar is over 300 or you feel confused or are vomiting.",
     json.dumps([{"role": "user", "text": "What about children under 12?"}, {"role": "agent", "text": "Children should be taken to the ER immediately if DKA is suspected."}]),
     2340, True, 85,
     "Clinically sound. Missed 'abdominal pain' from the expected answer. Emergency threshold correctly stated.",
     "completed"),

    (uid(), run2, q3,
     "What is the difference between a Roth IRA and a Traditional IRA?",
     "The main difference is tax timing. Traditional IRA gives you a tax deduction now but you pay taxes on withdrawals. Roth IRA uses after-tax money so withdrawals in retirement are tax-free.",
     json.dumps([{"role": "user", "text": "Which one is better for someone in their 30s?"}, {"role": "agent", "text": "Generally Roth IRA is preferred for younger investors who expect to be in a higher tax bracket at retirement."}]),
     1450, True, 96,
     "Excellent. Clear, accurate, and well-structured. Matches expected answer almost verbatim.",
     "completed"),

    (uid(), run3, q4,
     "A patient's discharge is delayed due to pending lab results. What are my options?",
     "You have a few options: escalate the lab request to high priority, call the lab directly, or speak with the attending physician about a conditional discharge pending results.",
     json.dumps([]),
     3100, True, 88,
     "Good coverage of options. Did not mention the internal hotline specifically. Practical and actionable.",
     "completed"),

    (uid(), run4, q5,
     "Do you have any noise-cancelling headphones under $150?",
     "We have a couple of great options! The Sony WH-CH720N is $99.99 and the Anker Soundcore Q45 is $79.99. Both feature active noise cancellation.",
     json.dumps([{"role": "user", "text": "Do they work with iPhone?"}, {"role": "agent", "text": "Yes, both models are compatible with iPhone via Bluetooth and include a 3.5mm cable option."}]),
     980, True, 98,
     "Perfect match. Correct products, prices, and feature call-out.",
     "completed"),
]


# ── Database operations ───────────────────────────────────────────────────────

def get_conn():
    dsn = dsn_from_url(DB_URL)
    return psycopg2.connect(dsn)


def clear_tables(cur):
    print("[seed] Clearing existing seed tables...")
    tables = [
        "test_run_results", "test_runs", "initiating_questions",
        "personality_profiles", "dimension_values", "dimensions",
        "personas", "products", "project_agents",
        "agents", "salesforce_connections", "test_projects",
    ]
    for t in tables:
        cur.execute(f"DELETE FROM {t}")
    print("[seed] Tables cleared.")


def seed(cur):
    ts = datetime.now(timezone.utc)

    # ── Connections ──────────────────────────────────────────────────────────
    print("[seed] Inserting connections...")
    execute_values(cur, """
        INSERT INTO salesforce_connections
            (id, name, connection_type, domain, consumer_key, consumer_secret, default_agent_id, config, created_at, updated_at)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], ts, ts) for r in CONNECTIONS])

    # ── Agents ───────────────────────────────────────────────────────────────
    print("[seed] Inserting agents...")
    execute_values(cur, """
        INSERT INTO agents
            (id, connection_id, salesforce_id, name, developer_name, agent_type, config, topics, actions, created_at, updated_at)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], json.dumps([]), json.dumps([]), ts, ts) for r in AGENTS])

    # ── Projects ─────────────────────────────────────────────────────────────
    print("[seed] Inserting projects...")
    execute_values(cur, """
        INSERT INTO test_projects
            (id, name, description, company_name, company_websites, industry, competitors, created_at, updated_at)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], ts, ts) for r in PROJECTS])

    # ── Project ↔ Agent links ─────────────────────────────────────────────────
    print("[seed] Inserting project_agents...")
    execute_values(cur, """
        INSERT INTO project_agents (id, project_id, agent_id)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, PROJECT_AGENTS)

    # ── Personas ─────────────────────────────────────────────────────────────
    print("[seed] Inserting personas...")
    execute_values(cur, """
        INSERT INTO personas (id, project_id, agent_id, name, description, tag, goal, personality, knowledge_level)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, PERSONAS)

    # ── Dimensions + Values ──────────────────────────────────────────────────
    print("[seed] Inserting dimensions...")
    execute_values(cur, """
        INSERT INTO dimensions (id, project_id, name)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, [(r[0], r[1], r[2]) for r in DIMENSIONS])

    print("[seed] Inserting dimension_values...")
    execute_values(cur, """
        INSERT INTO dimension_values (id, dimension_id, name, description)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, DIMENSION_VALUES)

    # ── Personality Profiles ─────────────────────────────────────────────────
    print("[seed] Inserting personality_profiles...")
    execute_values(cur, """
        INSERT INTO personality_profiles (id, project_id, name, description)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, PERSONALITY_PROFILES)

    # ── Questions ────────────────────────────────────────────────────────────
    print("[seed] Inserting initiating_questions...")
    execute_values(cur, """
        INSERT INTO initiating_questions
            (id, project_id, agent_id, question, expected_answer,
             persona, dimension, dimension_value, personality_profile)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]) for r in QUESTIONS])

    # ── Test Runs ─────────────────────────────────────────────────────────────
    print("[seed] Inserting test_runs...")
    execute_values(cur, """
        INSERT INTO test_runs
            (id, project_id, agent_id, status, total_questions, completed_questions, started_at, completed_at)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, TEST_RUNS)

    # ── Test Run Results ──────────────────────────────────────────────────────
    print("[seed] Inserting test_run_results...")
    execute_values(cur, """
        INSERT INTO test_run_results
            (id, run_id, question_id, question_text, response_text,
             follow_up_utterances, latency_ms, answered, score, evaluation_notes, status)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]) for r in TEST_RUN_RESULTS])

    print("[seed] ✓ All seed data inserted.")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed the testing_agent database.")
    parser.add_argument("--clear", action="store_true", help="Clear existing rows before seeding.")
    args = parser.parse_args()

    print(f"[seed] Connecting to database...")
    conn = get_conn()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        if args.clear:
            clear_tables(cur)

        seed(cur)
        conn.commit()
        print("[seed] ✓ Done. Committed.")

    except Exception as e:
        conn.rollback()
        print(f"[seed] ✗ Error: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
