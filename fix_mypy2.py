import os

def replace_in_file(filepath, replacements):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

# chatbot/llm.py
replace_in_file(
    "services/api/messfit_api/chatbot/llm.py",
    [
        ("def _system_prompt(profile_summary: str):", "def _system_prompt(profile_summary: str) -> str:"),
        ("import json\nimport logging", "import json\nimport logging\nfrom typing import Any")
    ]
)

# chatbot/router.py
replace_in_file(
    "services/api/messfit_api/chatbot/router.py",
    [
        ("async def list_conversations(\n    limit: int = Query(20, ge=1, le=100),\n    offset: int = Query(0, ge=0),\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n):",
         "async def list_conversations(\n    limit: int = Query(20, ge=1, le=100),\n    offset: int = Query(0, ge=0),\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n) -> Any:"),
        ("async def get_conversation(\n    conv_id: UUID,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n):",
         "async def get_conversation(\n    conv_id: UUID,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n) -> Any:"),
        ("async def chat(\n    conv_id: UUID,\n    payload: MessageIn,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n):",
         "async def chat(\n    conv_id: UUID,\n    payload: MessageIn,\n    user_id: str = Depends(get_current_user_id),\n    session: AsyncSession = Depends(get_session),\n) -> Any:"),
        ("from fastapi import APIRouter, Depends", "from typing import Any\nfrom fastapi import APIRouter, Depends")
    ]
)

# main.py
replace_in_file(
    "services/api/messfit_api/main.py",
    [
        ("async def health_check():", "async def health_check() -> Any:"),
        ("async def version():", "async def version() -> Any:"),
        ("from fastapi import FastAPI", "from typing import Any\nfrom fastapi import FastAPI")
    ]
)
print("Done")
