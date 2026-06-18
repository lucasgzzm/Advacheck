import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:admin@localhost:5432/webcheck_db")
if "+asyncpg" not in db_url and db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    async with async_session() as session:
        # Get count of documents in last hour
        result = await session.execute(text("SELECT count(*) FROM documentos_procesados"))
        count = result.scalar()
        print(f"Total documents in database: {count}")
        
        # Get all documents detail
        result = await session.execute(text("SELECT id, nombre_archivo, fecha_analisis, usuario_id FROM documentos_procesados ORDER BY fecha_analisis DESC LIMIT 25"))
        docs = result.all()
        print("\nLatest 25 documents in DB:")
        for doc in docs:
            print(f"ID: {doc[0]} | File: {doc[1]} | Date: {doc[2]} | User ID: {doc[3]}")

        # Get count in last 60 minutes
        result = await session.execute(text("SELECT count(*) FROM documentos_procesados WHERE fecha_analisis >= NOW() - INTERVAL '1 hour'"))
        count_1h = result.scalar()
        print(f"\nDocuments in the last 1 hour: {count_1h}")

if __name__ == "__main__":
    asyncio.run(main())
