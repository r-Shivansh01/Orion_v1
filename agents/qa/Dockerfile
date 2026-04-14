FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY agents/qa/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agents/shared /app/shared
COPY agents/qa /app/agent

ENV PYTHONPATH="/app:${PYTHONPATH}"

WORKDIR /app/agent

CMD ["python", "main.py"]
