import asyncio
import json
import logging
import os
from datetime import datetime

import aio_pika
from shared.db import get_db_connection, update_job_status, append_event
from shared.rabbitmq import get_rabbitmq_connection, create_channel_and_exchange
from agent import create_coder_crew

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("coder-agent")

AGENT_NAME = "alnilam"

async def publish_progress(exchange, job_id, event):
    """
    Helper to publish progress events to agent.progress queue.
    """
    message = aio_pika.Message(
        body=json.dumps(event).encode(),
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
    )
    await exchange.publish(message, routing_key="agent.progress")

async def process_message(message: aio_pika.IncomingMessage):
    async with message.process():
        body = json.loads(message.body.decode())
        job_id = body.get("job_id")
        event_type = body.get("event")
        payload = body.get("payload", {})
        
        logger.info(f"Processing {event_type} for job {job_id}")
        
        db_conn = await get_db_connection()
        rmq_conn = await get_rabbitmq_connection()
        
        try:
            channel, exchange = await create_channel_and_exchange(rmq_conn)
            
            # 1. Fetch current job state (especially retry_count)
            # We can also get retry_count from payload if it was sent, 
            # but DB is single source of truth.
            job_record = await db_conn.fetchrow("SELECT retry_count, plan_json, code_draft FROM jobs WHERE id = $1", job_id)
            if not job_record:
                logger.error(f"Job {job_id} not found in database")
                return

            retry_count = job_record["retry_count"]
            plan_json = payload.get("plan") or json.loads(job_record["plan_json"])
            
            # Check retry limit
            if retry_count >= 3:
                logger.warning(f"Job {job_id} exceeded max retries ({retry_count})")
                await update_job_status(db_conn, job_id, "FAILED")
                failure_event = {
                    "type": "TASK_FAILED",
                    "job_id": job_id,
                    "reason": "Maximum retry count reached.",
                    "retry_count": retry_count,
                    "timestamp": datetime.utcnow().isoformat()
                }
                await publish_progress(exchange, job_id, failure_event)
                await append_event(db_conn, job_id, failure_event)
                
                # Publish to task.failed
                fail_payload = {
                    "job_id": job_id,
                    "event": "task.failed",
                    "timestamp": datetime.utcnow().isoformat(),
                    "payload": {"reason": "Max retries exceeded"}
                }
                await exchange.publish(
                    aio_pika.Message(body=json.dumps(fail_payload).encode(), delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
                    routing_key="task.failed"
                )
                return

            # 2. AGENT_ACTIVATED
            activation_event = {
                "type": "AGENT_ACTIVATED",
                "agent": AGENT_NAME,
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, activation_event)
            await append_event(db_conn, job_id, activation_event)
            
            # 3. Update status to CODING
            await update_job_status(db_conn, job_id, "CODING")
            status_event = {
                "type": "STATUS_CHANGE",
                "old_status": "PLANNING" if event_type == "plan.completed" else "REVIEWING",
                "new_status": "CODING",
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, status_event)
            await append_event(db_conn, job_id, status_event)

            # 4. Prepare inputs for CrewAI
            rejected_code = None
            qa_feedback = None
            if event_type == "code.rejected":
                rejected_code = payload.get("code") or job_record["code_draft"]
                qa_feedback = payload.get("qa_feedback")

            async def publish_callback(event):
                try:
                    msg = aio_pika.Message(
                        body=json.dumps(event).encode(),
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                    )
                    await exchange.publish(msg, routing_key="agent.progress")
                except Exception as e:
                    logger.error(f"Streaming error: {e}")

            # 5. Run CrewAI Coder
            crew = create_coder_crew(job_id, plan_json, publish_callback, rejected_code, qa_feedback)
            result = crew.kickoff()
            
            # Clean up markdown fences if any
            code_draft = result.strip()
            if code_draft.startswith("```"):
                # Handle ```python or just ```
                first_newline = code_draft.find("\n")
                if first_newline != -1 and first_newline < 10:
                    code_draft = code_draft[first_newline:].strip()
                else:
                    code_draft = code_draft[3:].strip()
                if code_draft.endswith("```"):
                    code_draft = code_draft[:-3].strip()

            # 6. Update DB (status: REVIEWING, code_draft: '...', retry_count: N)
            new_retry_count = retry_count + 1 if event_type == "code.rejected" else retry_count
            await update_job_status(db_conn, job_id, "REVIEWING", code_draft=code_draft, retry_count=new_retry_count)
            
            review_status_event = {
                "type": "STATUS_CHANGE",
                "old_status": "CODING",
                "new_status": "REVIEWING",
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, review_status_event)
            await append_event(db_conn, job_id, review_status_event)

            # 7. Publish to code.drafted
            completion_payload = {
                "job_id": job_id,
                "event": "code.drafted",
                "timestamp": datetime.utcnow().isoformat(),
                "payload": {
                    "code": code_draft,
                    "language": plan_json.get("language", "python"),
                    "retry_count": new_retry_count
                }
            }
            completion_msg = aio_pika.Message(
                body=json.dumps(completion_payload).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            )
            await exchange.publish(completion_msg, routing_key="code.drafted")
            logger.info(f"Published code.drafted for job {job_id}")

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")
            await update_job_status(db_conn, job_id, "FAILED")
            failure_event = {
                "type": "TASK_FAILED",
                "job_id": job_id,
                "reason": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, failure_event)
            await append_event(db_conn, job_id, failure_event)
        finally:
            await db_conn.close()
            await rmq_conn.close()

async def main():
    logger.info("Starting Coder Agent (Alnilam)...")
    connection = await get_rabbitmq_connection()
    async with connection:
        channel = await connection.channel()
        await channel.set_prefetch(1)
        
        # Declare exchange for consistency
        await channel.declare_exchange("orion", aio_pika.ExchangeType.DIRECT, durable=True)
        
        # Consume from plan.completed
        plan_queue = await channel.declare_queue("plan.completed", durable=True)
        await plan_queue.bind("orion", routing_key="plan.completed")
        
        # Consume from code.rejected
        reject_queue = await channel.declare_queue("code.rejected", durable=True)
        await reject_queue.bind("orion", routing_key="code.rejected")
        
        logger.info("Waiting for tasks on plan.completed and code.rejected...")
        
        # Combine iterators or just use callbacks
        async def consume_queue(queue):
            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    await process_message(message)

        await asyncio.gather(
            consume_queue(plan_queue),
            consume_queue(reject_queue)
        )

if __name__ == "__main__":
    asyncio.run(main())
