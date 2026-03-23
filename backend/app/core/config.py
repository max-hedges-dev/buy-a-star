from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Aster Atlas"
    # User can override with .env file
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost/buyastar"

    class Config:
        case_sensitive = True

settings = Settings()
