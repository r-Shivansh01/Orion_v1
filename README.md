# Orion_v1

Orion_v1 is an event-driven microservices platform that orchestrates three specialized LLM agents — Alnitak (Planner), Alnilam (Coder), Mintaka (QA) — to complete software tasks autonomously end-to-end...

## Tech Stack
- **Frontend:** Next.js 14, Tailwind CSS, React Flow
- **API Gateway:** Node.js, Express, Prisma, RabbitMQ
- **Notification Service:** Python, FastAPI, WebSockets
- **Agents:** Python, CrewAI, Gemini 1.5 Flash
- **Infrastructure:** Docker, RabbitMQ, PostgreSQL, Prometheus, Grafana.

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Orion_v1
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values, especially GEMINI_API_KEY
   ```

3. **Start the infrastructure:**
   ```bash
   docker compose up -d postgres rabbitmq
   ```

4. **Run database migrations:**
   ```bash
   cd api-gateway
   npm install
   npx prisma migrate dev --name init
   cd ..
   ```

5. **Start all services:**
   ```bash
   docker compose up -d
   ```

6. **Access the platform:**
   - Frontend: `http://localhost:3000` (once deployed).
   - API Gateway: `http://localhost:4000`
   - RabbitMQ Management: `http://localhost:15672`
   - Prometheus: `http://localhost:9090`
   - Grafana: `http://localhost:3001`

## Directory Structure
- `api-gateway/`: Node.js Express API.
- `notification-service/`: Python FastAPI WebSocket service/
- `agents/`: AI agent services (Planner, Coder, QA).
- `frontend/`: Next.js web application.
- `infra/`: Configuration for Nginx, Prometheus, and Grafana.
