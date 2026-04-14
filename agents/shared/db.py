import os
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

import asyncpg

logger = logging.getLogger("shared-db")

DATABASE_URL = os.getenv("DATABASE_URL")

async def get_db_connection():
    """
    Returns an asyncpg connection to the database.
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise

async def append_event(conn, job_id: str, event: Dict[str, Any]):
    """
    Appends a new event to the event_log JSONB array in the jobs table.
    """
    if "timestamp" not in event:
        event["timestamp"] = datetime.utcnow().isoformat()
    
    try:
        # PostgreSQL syntax for appending to a JSONB array: event_log || $1::jsonb
        # We wrap the event dict in a list because we're appending to an array
        await conn.execute(
            "UPDATE jobs SET event_log = event_log || $1::jsonb WHERE id = $2",
            json.dumps([event]),
            job_id
        )
    except Exception as e:
        logger.error(f"Failed to append event to job {job_id}: {e}")
        # We don't necessarily want to fail the whole agent task if logging fails,
        # but in this project event logging is critical for replay.
        raise

async def update_job_status(conn, job_id: str, status: str, **kwargs):
    """
    Updates the status and other fields of a job.
    """
    valid_fields = {
        "plan_json", "code_draft", "final_output", 
        "retry_count", "qa_feedback", "qa_severity", "completed_at"
    }
    
    set_clauses = ["status = $1", "updated_at = NOW()"]
    values = [status, job_id]
    
    param_idx = 3
    for field, value in kwargs.items():
        if field in valid_fields:
            if field == "plan_json":
                # Ensure plan_json is dumped to string if it's a dict
                if isinstance(value, dict):
                    value = json.dumps(value)
            set_clauses.append(f"{field} = ${param_idx}")
            values.append(value)
            param_idx += 1
    
    query = f"UPDATE jobs SET {', '.join(set_clauses)} WHERE id = $2"
    
    try:
        await conn.execute(query, *values)
    except Exception as e:
        logger.error(f"Failed to update job {job_id}: {e}")
        raise
