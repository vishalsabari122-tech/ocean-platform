import requests
import datetime
from database import SessionLocal
from models import SpeciesObservation

def ingest_obis(taxon: str = "Cetacea", limit: int = 100):
    url = "https://api.obis.org/v3/occurrence"
    params = {"scientificname": taxon, "size": limit}

    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        records = data.get("results", [])
    except Exception as e:
        return {"status": "error", "message": f"OBIS API error: {str(e)}"}

    db = SessionLocal()
    saved = 0
    skipped = 0

    try:
        for rec in records:
            lat = rec.get("decimalLatitude")
            lon = rec.get("decimalLongitude")
            species = rec.get("scientificName") or rec.get("species")

            if not species:
                skipped += 1
                continue

            obs = SpeciesObservation(
                species_name=species,
                common_name=rec.get("vernacularName"),
                dataset=f"obis_{taxon}",
                depth_m=rec.get("depth"),
                observed_at=datetime.datetime.utcnow(),
                lat=lat,
                lon=lon,
            )
            db.add(obs)
            saved += 1

        db.commit()
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

    return {
        "status": "success",
        "taxon": taxon,
        "fetched": len(records),
        "saved": saved,
        "skipped": skipped,
    }