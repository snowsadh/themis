import json
import os
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, SecretStr, ValidationError, model_validator
from starlette.concurrency import run_in_threadpool

from .judge import JudgeUnavailable, configuration_status, evaluate_argument, generate_counsel
from .cases import MAX_CASE_CHARACTERS, extract_document, read_upload, search_cases

app = FastAPI(title="Themis", docs_url="/docs")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


class Case(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    facts: str = Field(min_length=1, max_length=MAX_CASE_CHARACTERS)
    issues: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(max_length=20)
    precedents: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(default_factory=list, max_length=50)
    petitioner_stand: str = Field(default="", max_length=4000)
    respondent_stand: str = Field(default="", max_length=4000)

    @model_validator(mode="after")
    def bounded_context(self):
        if not self.title.strip() or not self.facts.strip() or any(not value.strip() for value in self.issues + self.precedents):
            raise ValueError("The case contains an empty field.")
        if sum(map(len, [self.title, self.facts, self.petitioner_stand, self.respondent_stand, *self.issues, *self.precedents])) > 60000:
            raise ValueError("The combined case context exceeds 60,000 characters.")
        return self


class Turn(BaseModel):
    role: Literal["Petitioner", "Respondent", "Judge"]
    argument: str = Field(max_length=6000)
    speaker: Literal["petitioner", "respondent"] | None = None
    interrupt: bool = False


class Options(BaseModel):
    openai_key: SecretStr = Field(default=SecretStr(""), max_length=512)
    openai_model: str = Field(default="", max_length=120, pattern=r"^[a-zA-Z0-9:._/-]*$")
    allow_fallback: bool = True

    def provider_options(self):
        return {**self.model_dump(), "openai_key": self.openai_key.get_secret_value()}


class Submission(BaseModel):
    role: Literal["Petitioner", "Respondent"]
    text: str = Field(min_length=1, max_length=6000)
    history: list[Turn] = Field(default_factory=list, max_length=60)
    selectedCase: Case
    options: Options = Field(default_factory=Options)




class CounselRequest(BaseModel):
    role: Literal["Petitioner", "Respondent"]
    history: list[Turn] = Field(default_factory=list, max_length=60)
    selectedCase: Case
    options: Options = Field(default_factory=Options)



@app.exception_handler(RequestValidationError)
async def invalid_request(_request, _exc):
    # Never echo request inputs: options may contain an API key.
    return JSONResponse(status_code=422, content={"detail": "Check the case, argument and connection settings. Arguments allow 1–6,000 characters; case facts allow 1–30,000. Each issue or authority allows up to 1,000 characters."})


@app.get("/health")
def health():
    return {"status": "ok", **configuration_status()}






def evaluate(arg):
    if not arg.text.strip():
        raise HTTPException(422, "Write an argument before submitting.")
    try:
        return evaluate_argument(arg.role, arg.text.strip(), [t.model_dump() for t in arg.history], arg.selectedCase.model_dump(), arg.options.provider_options())
    except JudgeUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc


@app.post("/argue")
def argue(arg: Submission):
    return {"response": evaluate(arg)}




@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin and origin not in allowed:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        while True:
            try:
                raw = await websocket.receive_text()
                if len(raw) > 200000:
                    await websocket.close(code=1009)
                    return
                arg = Submission.model_validate_json(raw)
                await websocket.send_json(await run_in_threadpool(evaluate, arg))
            except (ValidationError, json.JSONDecodeError):
                await websocket.send_json({"error": "Invalid submission. Check the case and argument."})
            except HTTPException as exc:
                await websocket.send_json({"error": exc.detail})
    except WebSocketDisconnect:
        pass


@app.post("/counsel")
def counsel(arg: CounselRequest):
    try:
        return generate_counsel(arg.role, [t.model_dump() for t in arg.history], arg.selectedCase.model_dump(), arg.options.provider_options())
    except JudgeUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc



@app.get("/cases")
def cases(q: str = Query(default="", max_length=200), category: str = Query(default="", max_length=100), offset: int = Query(default=0, ge=0, le=10000), limit: int = Query(default=12, ge=1, le=50)):
    return search_cases(q, category, offset, limit)



@app.post("/cases/import")
async def import_case(request: Request):
    filename, data = await read_upload(request)
    return await run_in_threadpool(extract_document, filename, data)
