import os
import json
import asyncio
import logging
from typing import Dict, List, Set
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
import aio_pika
from prometheus_fastapi_instrumentator import Instrumentator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notification-service")

# Environment variables
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
JWT_SECRET = os.getenv("JWT_SECRET", "default_secret_change_me")
ALGORITHM = "HS256"

app = FastAPI(title="Orion Notification Service")

# Prometheus instrumentation
Instrumentator().instrument(app).bootstrap()

class ConnectionManager:
    def __init__(self):
        # job_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

    def disconnect(self, websocket: WebSocket, job_id: str):
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def subscribe(self, websocket: WebSocket, job_id: str):
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
        await websocket.send_json({
            "type": "SUBSCRIBED",
            "job_id": job_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        logger.info(f"Client subscribed to job {job_id}")

    async def broadcast(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            # Create a copy of the set to iterate over safely
            connections = list(self.active_connections[job_id])
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to client for job {job_id}: {e}")
                    # Potentially remove stale connection
                    self.active_connections[job_id].discard(connection)

manager = ConnectionManager()

def validate_token(token: str) -> bool:
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return True
    except JWTError:
        return False

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    subscribed_job_id = None
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "SUBSCRIBE":
                job_id = message.get("job_id")
                token = message.get("token")

                if not job_id or not token:
                    await websocket.send_json({"type": "ERROR", "message": "Missing job_id or token"})
                    await websocket.close()
                    return

                if validate_token(token):
                    subscribed_job_id = job_id
                    await manager.subscribe(websocket, job_id)
                else:
                    await websocket.send_json({"type": "ERROR", "message": "Unauthorized"})
                    await websocket.close()
                    return
            else:
                await websocket.send_json({"type": "ERROR", "message": "Expected SUBSCRIBE message"})
    
    except WebSocketDisconnect:
        if subscribed_job_id:
            manager.disconnect(websocket, subscribed_job_id)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if subscribed_job_id:
            manager.disconnect(websocket, subscribed_job_id)

async def process_rabbitmq_message(message: aio_pika.IncomingMessage):
    async with message.process():
        try:
            body = json.loads(message.body.decode())
            job_id = body.get("job_id")
            
            if not job_id:
                logger.warning("Received message without job_id")
                return

            # Map internal RabbitMQ event types to WebSocket event types if needed
            # The spec says WebSocket events should have 'type' field
            # And standard RabbitMQ envelope has 'event' field
            
            ws_message = {
                "type": body.get("event"),
                "job_id": job_id,
                "timestamp": body.get("timestamp", datetime.utcnow().isoformat())
            }
            
            # Add payload fields to top level as expected by WebSocket protocol
            if "payload" in body and isinstance(body["payload"], dict):
                ws_message.update(body["payload"])
            
            # Special case mapping based on GEMINI.md
            # task.completed -> TASK_COMPLETE
            # task.failed -> TASK_FAILED
            # agent.progress events already have specific types usually
            
            if body.get("event") == "task.completed":
                ws_message["type"] = "TASK_COMPLETE"
            elif body.get("event") == "task.failed":
                ws_message["type"] = "TASK_FAILED"
            
            logger.info(f"Broadcasting {ws_message['type']} for job {job_id}")
            await manager.broadcast(job_id, ws_message)
            
        except Exception as e:
            logger.error(f"Error processing RabbitMQ message: {e}")

async def consume_rabbitmq():
    while True:
        try:
            connection = await aio_pika.connect_robust(RABBITMQ_URL)
            async with connection:
                channel = await connection.channel()
                await channel.set_prefetch(1)

                # Declare exchange
                exchange = await channel.declare_exchange("orion", aio_pika.ExchangeType.DIRECT, durable=True)

                # Declare and bind queues
                queues_to_consume = ["task.completed", "task.failed", "agent.progress"]
                
                for queue_name in queues_to_consume:
                    queue = await channel.declare_queue(queue_name, durable=True)
                    await queue.bind(exchange, routing_key=queue_name)
                    await queue.consume(process_rabbitmq_message)
                
                logger.info(f"Connected to RabbitMQ and consuming queues: {queues_to_consume}")
                
                # Wait until the connection is closed
                await asyncio.Future()
        except Exception as e:
            logger.error(f"RabbitMQ connection error: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(consume_rabbitmq())

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "notification-service",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4001)
