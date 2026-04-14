import asyncio
import json
import logging
import os
from datetime import datetime

import aio_pika
from shared.db import get_db_connection, update_job_status, append_event
from shared.rabbitmq import get_rabbitmq_connection, create_channel_and_exchange
from agent import create_qa_crew

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("qa-agent")

AGENT_NAME = "mintaka"

async def publish_progress(exchange, job_id, event):
    """
    Helper to publish progress events to agent.progress queue.
    """
    message = aio_pika.Message(
        body=json.dumps(event).encode(),
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
    )
    await exchange.publish(message, routing_key="agent.progress")

async def process_task(message: aio_pika.IncomingMessage):
    async with message.process():
        body = json.loads(message.body.decode())
        job_id = body.get("job_id")
        payload = body.get("payload", {})
        code = payload.get("code")
        language = payload.get("language", "python")
        retry_count = payload.get("retry_count", 0)
        
        logger.info(f"Reviewing code for job {job_id} (retry: {retry_count})")
        
        db_conn = await get_db_connection()
        rmq_conn = await get_rabbitmq_connection()
        
        try:
            channel, exchange = await create_channel_and_exchange(rmq_conn)
            
            # 1. Fetch current job state (plan_json)
            job_record = await db_conn.fetchrow("SELECT plan_json FROM jobs WHERE id = $1", job_id)
            plan_json = json.loads(job_record["plan_json"])

            # 2. AGENT_ACTIVATED
            activation_event = {
                "type": "AGENT_ACTIVATED",
                "agent": AGENT_NAME,
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, activation_event)
            await append_event(db_conn, job_id, activation_event)
            
            # 3. Update status to REVIEWING (if not already)
            await update_job_status(db_conn, job_id, "REVIEWING")
            status_event = {
                "type": "STATUS_CHANGE",
                "old_status": "CODING",
                "new_status": "REVIEWING",
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, status_event)
            await append_event(db_conn, job_id, status_event)

            # 4. Run CrewAI QA
            async def publish_callback(event):
                try:
                    msg = aio_pika.Message(
                        body=json.dumps(event).encode(),
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                    )
                    await exchange.publish(msg, routing_key="agent.progress")
                except Exception as e:
                    logger.error(f"Streaming error: {e}")

            crew = create_qa_crew(job_id, code, language, plan_json, publish_callback)
            result = crew.kickoff()
            
            # Parse result (expecting JSON)
            try:
                clean_result = result.strip()
                if clean_result.startswith("```json"):
                    clean_result = clean_result[7:-3].strip()
                elif clean_result.startswith("```"):
                    clean_result = clean_result[3:-3].strip()
                
                qa_result = json.loads(clean_result)
            except Exception as e:
                logger.error(f"Failed to parse QA result JSON: {e}. Raw result: {result}")
                # Fallback to PASS if LLM failed but probably wrote something okay?
                # Actually, safety first: FAIL if we can't parse it.
                qa_result = {
                    "decision": "FAIL",
                    "severity": 5,
                    "feedback": "The QA agent failed to produce a structured review. Please re-check the code."
                }

            decision = qa_result.get("decision", "FAIL")
            severity = int(qa_result.get("severity", 0))
            feedback = qa_result.get("feedback", "No feedback provided.")

            # 19.2 QA Severity Scoring — Auto-pass minor issues
            if decision == "FAIL" and severity <= 3:
                logger.info(f"Auto-passing job {job_id} despite minor issues (severity {severity})")
                decision = "PASS"
                # Log the auto-pass
                auto_pass_msg = f"Minor issues found (severity {severity}/10) — auto-passing. {feedback}"
                await publish_progress(exchange, job_id, {
                    "type": "AGENT_LOG",
                    "agent": "qa",
                    "message": auto_pass_msg,
                    "timestamp": datetime.utcnow().isoformat()
                })

            if decision == "PASS":
                # 5. PASS: COMPLETED
                logger.info(f"Job {job_id} PASSED review")
                await update_job_status(db_conn, job_id, "COMPLETED", final_output=code, qa_severity=severity, completed_at=datetime.utcnow())
                
                completion_status_event = {
                    "type": "STATUS_CHANGE",
                    "old_status": "REVIEWING",
                    "new_status": "COMPLETED",
                    "job_id": job_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
                await publish_progress(exchange, job_id, completion_status_event)
                await append_event(db_conn, job_id, completion_status_event)

                # Final log for TaskComplete
                final_event = {
                    "type": "TASK_COMPLETE",
                    "job_id": job_id,
                    "final_output": code,
                    "language": language,
                    "timestamp": datetime.utcnow().isoformat()
                }
                await publish_progress(exchange, job_id, final_event)
                await append_event(db_conn, job_id, final_event)

                # Publish to task.completed
                final_payload = {
                    "job_id": job_id,
                    "event": "task.completed",
                    "timestamp": datetime.utcnow().isoformat(),
                    "payload": {
                        "final_output": code,
                        "language": language
                    }
                }
                await exchange.publish(
                    aio_pika.Message(body=json.dumps(final_payload).encode(), delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
                    routing_key="task.completed"
                )
            else:
                # 6. FAIL: code.rejected
                logger.info(f"Job {job_id} FAILED review (severity {severity})")
                await update_job_status(db_conn, job_id, "REVIEWING", qa_severity=severity, qa_feedback=feedback)
                
                # We don't change status to CODING here, Coder will do it.
                # But we publish a QA_REJECTED event
                rejection_event = {
                    "type": "QA_REJECTED",
                    "job_id": job_id,
                    "feedback": feedback,
                    "severity": severity,
                    "retry_count": retry_count,
                    "timestamp": datetime.utcnow().isoformat()
                }
                await publish_progress(exchange, job_id, rejection_event)
                await append_event(db_conn, job_id, rejection_event)

                # Publish to code.rejected
                reject_payload = {
                    "job_id": job_id,
                    "event": "code.rejected",
                    "timestamp": datetime.utcnow().isoformat(),
                    "payload": {
                        "code": code,
                        "qa_feedback": feedback,
                        "severity": severity,
                        "retry_count": retry_count
                    }
                }
                await exchange.publish(
                    aio_pika.Message(body=json.dumps(reject_payload).encode(), delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
                    routing_key="code.rejected"
                )

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")
            # If QA fails itself (e.g. LLM error), we don't necessarily fail the job, 
            # but we might want to log it.
            await publish_progress(exchange, job_id, {
                "type": "AGENT_LOG",
                "agent": "qa",
                "message": f"QA Internal Error: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            })
        finally:
            await db_conn.close()
            await rmq_conn.close()

async def main():
    logger.info("Starting QA Agent (Mintaka)...")
    connection = await get_rabbitmq_connection()
    async with connection:
        channel = await connection.channel()
        await channel.set_prefetch(1)
        
        queue = await channel.declare_queue("code.drafted", durable=True)
        
        logger.info("Waiting for tasks on code.drafted...")
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await process_task(message)

if __name__ == "__main__":
    asyncio.run(main())
