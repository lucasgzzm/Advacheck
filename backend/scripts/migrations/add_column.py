import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def alter_table():
    engine = create_async_engine("postgresql+asyncpg://postgres:admin@localhost:5432/webcheck_db")
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS online BOOLEAN DEFAULT FALSE"))
    print("Column added successfully.")

if __name__ == "__main__":
    asyncio.run(alter_table())
