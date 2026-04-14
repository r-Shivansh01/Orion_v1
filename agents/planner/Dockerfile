FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from agent-specific folder
COPY agents/planner/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared library
COPY agents/shared /app/shared

# Copy agent code
COPY agents/planner /app/agent

# Set PYTHONPATH to include the /app directory so 'from shared.db' works
ENV PYTHONPATH="/app:${PYTHONPATH}"

WORKDIR /app/agent

CMD ["python", "main.py"]
