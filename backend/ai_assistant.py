import os
import requests
from database import SessionLocal
from sqlalchemy import text

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

def query_database(sql: str) -> list:
    db = SessionLocal()
    try:
        clean_sql = sql.strip().rstrip(";")
        if not clean_sql.upper().startswith("SELECT"):
            return {"error": "Only SELECT queries allowed"}
        result = db.execute(text(clean_sql))
        rows = result.fetchall()
        columns = list(result.keys())
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

def get_db_schema() -> str:
    return """
Table: species_observations
Columns:
  - id (integer)
  - species_name (text) - scientific name
  - common_name (text, nullable)
  - dataset (text) - always 'OBIS'
  - depth_m (float, nullable) - depth in metres
  - observed_at (timestamp)
  - location (geometry POINT SRID 4326) - ST_X(location)=longitude, ST_Y(location)=latitude

Sample queries:
  SELECT species_name, common_name, depth_m FROM species_observations WHERE depth_m > 500 ORDER BY depth_m DESC LIMIT 10
  SELECT species_name, COUNT(*) as count FROM species_observations GROUP BY species_name ORDER BY count DESC LIMIT 10
  SELECT DISTINCT species_name, common_name FROM species_observations WHERE common_name ILIKE '%whale%'
"""

def ask_claude(question: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return {"error": "GROQ_API_KEY not set in environment"}

    schema = get_db_schema()
    prompt = f"""You are a marine biology database assistant.

Database schema:
{schema}

User question: {question}

Write a single valid PostgreSQL SELECT query to answer this question.
Return ONLY the raw SQL query. No explanation, no markdown, no backticks, no semicolon."""

    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 500
            },
            timeout=30
        )

        if not response.ok:
            return {"error": f"Groq API error {response.status_code}: {response.text}", "question": question}

        data = response.json()
        sql = data["choices"][0]["message"]["content"].strip()
        sql = sql.replace("```sql", "").replace("```", "").strip().rstrip(";")

        results = query_database(sql)

        return {
            "question": question,
            "sql_generated": sql,
            "results": results,
            "count": len(results) if isinstance(results, list) else 0
        }

    except Exception as e:
        return {"error": str(e), "question": question}