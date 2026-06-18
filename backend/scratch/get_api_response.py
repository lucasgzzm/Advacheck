import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import os
from dotenv import load_dotenv

# Load env
load_dotenv()

db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:admin@localhost:5432/webcheck_db")
if "+asyncpg" not in db_url and db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    from app.rutas.documentos import obtener_limite_documentos
    from app.modelos import Usuario
    
    async with async_session() as db:
        # Get first user
        result = await db.execute(select(Usuario))
        user = result.scalars().first()
        if not user:
            print("No users found in database!")
            return
            
        print(f"Testing route for user: {user.email} (ID: {user.id})")
        res = await obtener_limite_documentos(db, user)
        print("API Response:")
        print(res)

if __name__ == "__main__":
    asyncio.run(main())
