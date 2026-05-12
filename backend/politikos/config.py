from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # civicAPI
    civicapi_base_url: str = "https://civicapi.org/api/v2"
    civicapi_user_agent: str = "politikos/0.1"

    # Postgres
    postgres_user: str = "politikos"
    postgres_password: str = "politikos"
    postgres_db: str = "politikos"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Poller cadences (seconds)
    poller_live_interval: int = 20
    poller_election_day_idle_interval: int = 120
    poller_upcoming_interval: int = 3600
    poller_historical_interval: int = 86400

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8090
    api_cors_origins: str = "http://localhost:5173"

    # v1 scope
    country_filter: str = "US"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
