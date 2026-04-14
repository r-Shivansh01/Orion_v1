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

def create_qa_crew(job_id: str, code: str, language: str, plan_json: Dict, publish_fn):
    """
    Creates the Mintaka QA crew.
    """
    gemini_llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=os.environ["GEMINI_API_KEY"],
        temperature=0.3,
        streaming=True,
        callbacks=[RabbitMQStreamingHandler(job_id, "mintaka", publish_fn)]
    )

    qa_agent = Agent(
        role="Senior QA Engineer & Security Reviewer",
        goal="Rigorously review code for correctness, security vulnerabilities, and adherence to the original plan. Return a severity-scored JSON decision. Approve only code that is production-ready.",
        backstory="You are a meticulous code reviewer who catches bugs others miss. You provide specific, actionable feedback when rejecting code, and assign a severity score that reflects how serious the issues are.",
        llm=gemini_llm,
        allow_delegation=False,
        verbose=True
    )

    qa_task = Task(
        description=f"""Review the following {language} code:

{code}

The code was written to fulfill this plan: {json.dumps(plan_json)}

Check for:
1. Logical errors or incorrect implementation
2. Security vulnerabilities (SQL injection, path traversal, hardcoded secrets, etc.)
3. Unhandled exceptions or edge cases
4. Whether the code actually satisfies the original plan

Your response must be a JSON object with exactly three fields:
{{
  "decision": "PASS" or "FAIL",
  "severity": <integer 1-10 where 1=trivial style issue, 10=critical security vulnerability. Set to 0 if PASS.>,
  "feedback": "If PASS, write 'Code is correct and secure.' If FAIL, write specific, line-by-line feedback on every issue found."
}}

Severity guide: 1-3 = minor style/readability; 4-7 = logic bugs or missing edge cases; 8-10 = security vulnerabilities or completely wrong implementation.

Return ONLY valid JSON. No markdown.""",
        expected_output="A JSON object with decision, severity, and feedback.",
        agent=qa_agent
    )

    return Crew(
        agents=[qa_agent],
        tasks=[qa_task],
        verbose=True
    )
