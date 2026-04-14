import os
import json
import logging
from datetime import datetime
from typing import Any, Dict

import aio_pika

logger = logging.getLogger("shared-rabbitmq")

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

async def get_rabbitmq_connection():
    """
    Connects to RabbitMQ and returns a robust connection.
    """
    try:
        connection = await aio_pika.connect_robust(RABBITMQ_URL)
        return connection
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        raise

async def publish_event(job_id: str, event_type: str, payload: Dict[str, Any]):
    """
    Connects, publishes an event with the standard message envelope, and closes connection.
    Use this for one-off publishes. For agents, a persistent channel is better.
    """
    try:
        connection = await get_rabbitmq_connection()
        async with connection:
            channel = await connection.channel()
            
            # Declare exchange
            exchange = await channel.declare_exchange(
                "orion", 
                aio_pika.ExchangeType.DIRECT, 
                durable=True
            )
            
            # Message structure
            message_body = {
                "job_id": job_id,
                "event": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "payload": payload
            }
            
            message = aio_pika.Message(
                body=json.dumps(message_body).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            )
            
            # Routing key is typically the event name or queue name
            # Map event type to queue name if different
            routing_key = event_type
            
            await exchange.publish(message, routing_key=routing_key)
            logger.info(f"Published event {event_type} for job {job_id}")
            
    except Exception as e:
        logger.error(f"Failed to publish event {event_type} for job {job_id}: {e}")
        raise

async def create_channel_and_exchange(connection):
    """
    Helper to prepare a channel and the 'orion' exchange.
    """
    channel = await connection.channel()
    await channel.set_prefetch(1)
    
    exchange = await channel.declare_exchange(
        "orion", 
        aio_pika.ExchangeType.DIRECT, 
        durable=True
    )
    
    return channel, exchange
