from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx
from app.core.config import settings
from app.core.database import get_db
from app.models.schema import Product, Sale
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatRequest(BaseModel):
    message: str

@router.post("/chat")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured on server")
    
    try:
        # 1. AGGREGATE DATA SNAPSHOT (SNA P1)
        # Get Products
        p_result = await db.execute(select(Product))
        products = p_result.scalars().all()
        
        # Get Sales (Last 30 days for trend analysis)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        s_result = await db.execute(select(Sale).where(Sale.date >= thirty_days_ago))
        sales = s_result.scalars().all()
        
        # Format snapshot for AI context
        snapshot = {
            "inventory": [
                {"name": p.name, "qty": p.qty, "min_stock": p.min_stock, "price": p.price} 
                for p in products
            ],
            "recent_sales_summary": [
                {"prod_id": s.product_id, "qty": s.qty, "total": s.total_price, "date": s.date.strftime("%Y-%m-%d")}
                for s in sales
            ],
            "insights_request_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        }

        # 2. SYSTEM PROMPT ENGINEERING (SNA P2)
        system_prompt = (
            "You are the SAM IMS Intelligent Analyst. Your goal is to provide deep business insights using the provided data.\n"
            "When asked about sales trends, analyze the correlation between stock levels and revenue.\n"
            "Format your responses using Markdown for readability (use headers, bold text, and bullet points).\n"
            "If you detect a product was low on stock during a period of low sales, point it out as a potential missed opportunity.\n"
            "NEVER mention employee names or PII.\n\n"
            f"CURRENT DATA SNAPSHOT:\n{json.dumps(snapshot, indent=2)}"
        )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": request.message}
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.2 # Lower temperature for analytical accuracy
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"Groq API Error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail="Error from Groq API")
            
            data = response.json()
            return {"reply": data["choices"][0]["message"]["content"]}
            
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
