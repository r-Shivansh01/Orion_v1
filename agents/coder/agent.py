import os
from typing import Dict, List, Optional
from datetime import datetime
import json

from crewai import Agent, Task, Crew
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.callbacks.base import BaseCallbackHandler

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

LANGUAGE_SPECIFIC_INSTRUCTIONS = {
    "python": "Prefer list comprehensions, use type hints, follow PEP 8, and use modern Python 3.11+ features.",
    "javascript": "Use async/await, prefer const/let over var, use ES2022+ features, and follow idiomatic Node.js patterns.",
    "bash": "Use shellcheck-compliant syntax, handle errors with 'set -e', and use local variables in functions.",
    "other": "Follow best practices and industry standards for the detected language."
}

def create_coder_crew(job_id: str, plan_json: Dict, publish_fn, rejected_code: Optional[str] = None, qa_feedback: Optional[str] = None):
    """
    Creates the Alnilam Coder crew.
    """
    gemini_llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=os.environ["GEMINI_API_KEY"],
        temperature=0.3,
        streaming=True,
        callbacks=[RabbitMQStreamingHandler(job_id, "alnilam", publish_fn)]
    )

    coder_agent = Agent(
        role="Expert Software Developer",
        goal="Write clean, working, well-commented code that precisely implements the given plan. Fix issues identified by the QA reviewer when code is rejected.",
        backstory="You are a senior developer who writes production-quality code. When your code is rejected, you carefully read the feedback and fix every issue.",
        llm=gemini_llm,
        allow_delegation=False,
        verbose=True
    )

    language = plan_json.get("language", "python").lower()
    lang_instr = LANGUAGE_SPECIFIC_INSTRUCTIONS.get(language, LANGUAGE_SPECIFIC_INSTRUCTIONS["other"])

    if rejected_code and qa_feedback:
        description = f"""Your previous code was rejected by the QA reviewer.
QA Feedback: "{qa_feedback}"

Original Plan: {json.dumps(plan_json)}
Your rejected code:
{rejected_code}

Fix every issue identified in the QA feedback. 
Language-specific instructions: {lang_instr}

Return ONLY the corrected code. No markdown fences. No explanation."""
    else:
        description = f"""You are given the following execution plan:
{json.dumps(plan_json)}

Write the complete, working code that implements this plan exactly.
Requirements:
- Code must be fully functional with no placeholders
- Include inline comments explaining key logic
- Handle edge cases and errors gracefully
- Do not include any explanation outside of code comments
- Language-specific instructions: {lang_instr}

Return ONLY the raw code. No markdown fences. No explanation."""

    coder_task = Task(
        description=description,
        expected_output="Complete, working, well-commented code.",
        agent=coder_agent
    )

    return Crew(
        agents=[coder_agent],
        tasks=[coder_task],
        verbose=True
    )
