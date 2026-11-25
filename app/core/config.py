import logging
import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

DEFAULT_SECRET = "change-this-in-production-use-256-bit-random-key"


class Settings(BaseSettings):
    # Database. Local dev falls back to a SQLite file; production sets a Postgres URL.
    DATABASE_URL: str = "sqlite+aiosqlite:///./stockwaves.db"

    # Cache
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    SECRET_KEY: str = DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Demo mode: seeds sample data and the three demo logins, and lets the
    # login screen list them. Turn off for a real business.
    SEED_DEMO: bool = True

    # Optional first admin, created on startup if no users exist yet.
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_NAME: str = "Owner"

    # AI
    ANTHROPIC_API_KEY: str = ""
    XAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # Snap-a-Bill (reading supplier bills from photos).
    # BILL_AI_PROVIDER: "anthropic", "groq", or empty to use whichever key is set (Anthropic first).
    # "demo" returns a fixed sample reading for local UI testing only; never use it in production.
    BILL_AI_PROVIDER: str = ""
    BILL_AI_MODEL: str = ""        # empty = provider default (claude-opus-5-5 / qwen/qwen3.8-27b)
    BILL_AI_EFFORT: str = "low"    # Claude effort; low keeps a scan to a few seconds

    # Command bar: free-form commands and questions (simple commands work without a key).
    ASSISTANT_PROVIDER: str = ""   # "anthropic", "groq", or empty for whichever key is set
    ASSISTANT_MODEL: str = ""      # empty = claude-opus-5-5 / qwen/qwen3.8-27b
    ASSISTANT_EFFORT: str = "low"

    # WhatsApp brief (Meta WhatsApp Cloud API). Without a token and phone number id, messages
    # are kept in the app's preview instead of being sent, so everything can be tried first.
    WHATSAPP_TOKEN: str = ""             # permanent access token of a Meta system user
    WHATSAPP_PHONE_NUMBER_ID: str = ""   # the sending number's id (not the number itself)
    WHATSAPP_APP_SECRET: str = ""        # Meta app secret; incoming webhooks are rejected without it
    WHATSAPP_VERIFY_TOKEN: str = ""      # any value you choose; enter the same one in Meta's webhook setup
    WHATSAPP_GRAPH_VERSION: str = "v26.0"
    # Approved template used when the person hasn't messaged in 24 hours (WhatsApp's rule
    # for business-started chats). See the README for its exact text.
    WHATSAPP_BRIEF_TEMPLATE: str = ""
    WHATSAPP_TEMPLATE_LANG: str = "en"
    WHATSAPP_SCHEDULER: bool = True      # send the daily brief from the API process
    PUBLIC_API_URL: str = ""             # e.g. https://api.example.com; Railway's domain is used if empty
    RAILWAY_PUBLIC_DOMAIN: str = ""

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def async_database_url(self) -> str:
        """Hosts hand out postgres:// URLs; SQLAlchemy async needs the driver named."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        return url

    @property
    def is_sqlite(self) -> bool:
        return self.async_database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.SECRET_KEY == DEFAULT_SECRET:
        # Never sign tokens with a key that is published in the repo.
        # A random key keeps the app secure; tokens just stop working after a restart.
        logger.warning("SECRET_KEY is not set. Using a random key; set SECRET_KEY so logins survive restarts.")
        s.SECRET_KEY = secrets.token_hex(32)
    return s


settings = get_settings()
