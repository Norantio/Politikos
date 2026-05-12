import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import feed as feed_router
from .api import races as races_router
from .api import ws as ws_router
from .config import settings
from .db.session import init_db
from .ingest.civicapi import CivicAPIClient
from .ingest.poller import attach_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("politikos")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    client = CivicAPIClient()
    app.state.civicapi = client
    sched = attach_scheduler(app, client)
    app.state.sched = sched
    logger.info("politikos started — country_filter=%s", settings.country_filter)
    try:
        yield
    finally:
        sched.shutdown(wait=False)
        await client.aclose()


app = FastAPI(title="Politikos API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.api_cors_origins.split(",") if o.strip()],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(races_router.router, prefix="/api")
app.include_router(feed_router.router, prefix="/api")
app.include_router(ws_router.router)
