import asyncio
import json
import logging
import os
from datetime import datetime

import aio_pika
from shared.db import get_db_connection, update_job_status, append_event
from shared.rabbitmq import get_rabbitmq_connection, create_channel_and_exchange
from agent import create_planner_crew, classify_language

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("planner-agent")

AGENT_NAME = "alnitak"

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
        prompt = body.get("payload", {}).get("prompt")
        
        logger.info(f"Processing task for job {job_id}")
        
        db_conn = await get_db_connection()
        rmq_conn = await get_rabbitmq_connection()
        
        try:
            channel, exchange = await create_channel_and_exchange(rmq_conn)
            
            # 1. AGENT_ACTIVATED
            activation_event = {
                "type": "AGENT_ACTIVATED",
                "agent": AGENT_NAME,
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, activation_event)
            await append_event(db_conn, job_id, activation_event)
            
            # 2. Update status to PLANNING
            await update_job_status(db_conn, job_id, "PLANNING")
            status_event = {
                "type": "STATUS_CHANGE",
                "old_status": "PENDING",
                "new_status": "PLANNING",
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, status_event)
            await append_event(db_conn, job_id, status_event)

            # 3. Language classification (pre-step)
            detected_lang = classify_language(prompt)
            logger.info(f"Detected language: {detected_lang}")
            
            # 4. Run CrewAI Planner
            async def publish_callback(event):
                # This wrapper helps the handler talk to the exchange
                # Re-using the same connection might be tricky if it's closed,
                # but here we keep rmq_conn open.
                try:
                    msg = aio_pika.Message(
                        body=json.dumps(event).encode(),
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT
                    )
                    await exchange.publish(msg, routing_key="agent.progress")
                except Exception as e:
                    logger.error(f"Streaming error: {e}")

            crew = create_planner_crew(job_id, prompt, publish_callback)
            result = crew.kickoff()
            
            # Parse result (expecting JSON)
            try:
                # result might have backticks if LLM didn't follow "ONLY JSON" perfectly
                clean_result = result.strip()
                if clean_result.startswith("```json"):
                    clean_result = clean_result[7:-3].strip()
                elif clean_result.startswith("```"):
                    clean_result = clean_result[3:-3].strip()
                
                plan_json = json.loads(clean_result)
            except Exception as e:
                logger.error(f"Failed to parse plan JSON: {e}. Raw result: {result}")
                # Fallback plan
                plan_json = {
                    "objective": prompt,
                    "language": detected_lang,
                    "steps": [{"step": 1, "action": "Implement the task", "details": "The planner failed to produce structured steps."}],
                    "expected_output": "Working code."
                }

            # Ensure language from classifier is used if LLM didn't provide it
            if "language" not in plan_json:
                plan_json["language"] = detected_lang

            # 5. Update DB (status: CODING, plan_json: {...})
            # Wait, spec says "Planner updates DB (status: CODING, plan_json: {...}) WHERE id = job_id"
            await update_job_status(db_conn, job_id, "CODING", plan_json=plan_json)
            
            coding_status_event = {
                "type": "STATUS_CHANGE",
                "old_status": "PLANNING",
                "new_status": "CODING",
                "job_id": job_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            await publish_progress(exchange, job_id, coding_status_event)
            await append_event(db_conn, job_id, coding_status_event)

            # 6. Publish to plan.completed
            completion_payload = {
                "job_id": job_id,
                "event": "plan.completed",
                "timestamp": datetime.utcnow().isoformat(),
                "payload": {
                    "plan": plan_json
                }
            }
            completion_msg = aio_pika.Message(
                body=json.dumps(completion_payload).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            )
            await exchange.publish(completion_msg, routing_key="plan.completed")
            logger.info(f"Published plan.completed for job {job_id}")

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")
            # Optionally publish failure
            # But Coder or QA usually handle final failures. 
            # If Planner fails, we might want to mark job as FAILED.
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
    logger.info("Starting Planner Agent (Alnitak)...")
    connection = await get_rabbitmq_connection()
    async with connection:
        channel = await connection.channel()
        await channel.set_prefetch(1)
        
        queue = await channel.declare_queue("task.created", durable=True)
        
        logger.info("Waiting for tasks on task.created...")
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await process_task(message)

if __name__ == "__main__":
    asyncio.run(main())
