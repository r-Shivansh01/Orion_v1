import os
from typing import Dict, List, Optional
from datetime import datetime
import json

from crewai import Agent, Task, Crew
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.callbacks.base import BaseCallbackHandler

# Language hints for the classifier
LANGUAGE_HINTS = {
    "python": ["scrape", "csv", "pandas", "data", "ml", "flask", "django", "api", "python"],
    "javascript": ["react", "node", "npm", "frontend", "express", "html", "dom", "javascript", "js"],
    "bash": ["shell", "cron", "script", "grep", "awk", "deploy", "linux", "bash", "sh"],
}

def classify_language(prompt: str) -> str:
    """
    Lightweight keyword classifier to detect task domain.
    """
    prompt_lower = prompt.lower()
    scores = {lang: sum(1 for kw in kws if kw in prompt_lower)
              for lang, kws in LANGUAGE_HINTS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "python"  # default to python

class RabbitMQStreamingHandler(BaseCallbackHandler):
    """
    Custom LangChain callback handler to stream tokens to RabbitMQ.
    """
    def __init__(self, job_id: str, agent_name: str, publish_fn):
        self.job_id = job_id
        self.agent_name = agent_name
        self.publish_fn = publish_fn

    def on_llm_new_token(self, token: str, **kwargs) -> None:
        import asyncio
        # Since this is called from a sync context in CrewAI/LangChain,
        # we need to handle the async publish. 
        # Actually, in async agents, this might be called differently.
        # But for now, we'll use a wrapper.
        event = {
            "type": "AGENT_LOG",
            "agent": self.agent_name,
            "message": token,
            "stream": True,
            "job_id": self.job_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.publish_fn(event))
            else:
                asyncio.run(self.publish_fn(event))
        except Exception:
            pass

def create_planner_crew(job_id: str, prompt: str, publish_fn):
    """
    Creates the Alnitak Planner crew.
    """
    gemini_llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=os.environ["GEMINI_API_KEY"],
        temperature=0.3,
        streaming=True,
        callbacks=[RabbitMQStreamingHandler(job_id, "alnitak", publish_fn)]
    )

    planner_agent = Agent(
        role="Senior Software Architect",
        goal="Decompose the user's task into a clear, step-by-step JSON execution plan that a developer can follow precisely.",
        backstory="You are an expert at breaking down complex software requirements into atomic, ordered development steps.",
        llm=gemini_llm,
        allow_delegation=False,
        verbose=True
    )

    plan_task = Task(
        description=f"""You are given the following user task:
"{prompt}"

Your job is to create a structured JSON execution plan. The plan must:
1. Identify the programming language best suited for the task
2. Break the task into 3-7 atomic, ordered steps
3. Describe exactly what code needs to be written in each step
4. State the expected final output

Return ONLY a valid JSON object. No markdown, no explanation. JSON only.""",
        expected_output="A structured JSON execution plan.",
        agent=planner_agent
    )

    return Crew(
        agents=[planner_agent],
        tasks=[plan_task],
        verbose=True
    )
