from sqlalchemy import create_engine, inspect
from app.core.config import settings

# Use sync driver
url = settings.DATABASE_URL.replace("+asyncpg", "")
engine = create_engine(url)
inspector = inspect(engine)
print("Tables:", inspector.get_table_names())
