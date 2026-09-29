from pathlib import Path
from typing import List

from platformdirs import user_data_dir
from pydantic_settings import BaseSettings, SettingsConfigDict

# macOS: ~/Library/Application Support/DividendCase
# Windows: %LOCALAPPDATA%\DividendCase\DividendCase
# Linux: ~/.local/share/DividendCase
DEFAULT_DATA_DIR = Path(user_data_dir("DividendCase", "DividendCase"))


class Settings(BaseSettings):
    """Settings for the local app. Override any of them with DIVIDENDCASE_* environment variables."""

    model_config = SettingsConfigDict(env_prefix="DIVIDENDCASE_", extra="ignore")

    data_dir: Path = DEFAULT_DATA_DIR
    database_url: str = ""  # empty = SQLite file inside data_dir
    host: str = "127.0.0.1"
    port: int = 8765
    # The Next.js dev server (npm run dev) talks to the API from another origin
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    log_level: str = "INFO"
    # Fetch holdings and screener data in the background (off in tests)
    auto_refresh: bool = True
    # Ask PyPI once a day whether a newer version exists (off in tests; users can also
    # turn it off in Settings)
    check_updates: bool = True

    @property
    def resolved_database_url(self) -> str:
        return self.database_url or f"sqlite+aiosqlite:///{self.data_dir / 'dividendcase.db'}"

    @property
    def backup_dir(self) -> Path:
        """Copies of the database saved before each upgrade."""
        return self.data_dir / "backups"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
