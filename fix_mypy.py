import os

def replace_in_file(filepath, replacements):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

# mess/tasks.py
replace_in_file(
    "services/api/messfit_api/mess/tasks.py",
    [
        ("async def _set(db: AsyncSession, job_id: uuid.UUID, **values) -> None:",
         "from typing import Any\n\nasync def _set(db: AsyncSession, job_id: uuid.UUID, **values: Any) -> None:")
    ]
)

# chatbot/llm.py
replace_in_file(
    "services/api/messfit_api/chatbot/llm.py",
    [
        ("def _system_prompt(profile_summary: str):", "def _system_prompt(profile_summary: str) -> str:"),
        ("def _groq_client():", "from typing import Any\n\ndef _groq_client() -> Any:")
    ]
)

# chatbot/router.py
replace_in_file(
    "services/api/messfit_api/chatbot/router.py",
    [
        ("async def list_conversations(\n    limit: int = 20,\n    offset: int = 0,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n):",
         "from typing import Any\n\nasync def list_conversations(\n    limit: int = 20,\n    offset: int = 0,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n) -> Any:"),
        ("async def get_conversation(\n    conv_id: UUID,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n):",
         "async def get_conversation(\n    conv_id: UUID,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n) -> Any:"),
        ("async def chat(\n    conv_id: UUID,\n    payload: MessageIn,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n):",
         "async def chat(\n    conv_id: UUID,\n    payload: MessageIn,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n) -> Any:")
    ]
)

# main.py
replace_in_file(
    "services/api/messfit_api/main.py",
    [
        ("async def health_check():", "from typing import Any\n\n@app.get(\"/health\")\nasync def health_check() -> Any:"),
        ("async def version():", "@app.get(\"/version\")\nasync def version() -> Any:")
    ]
)
print("Done")
