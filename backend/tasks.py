import requests
from celery_app import celery
from database import SessionLocal
from models import SpeciesObservation
from geoalchemy2.elements import WKTElement
import datetime

OBIS_URL = "https://api.obis.org/v3/occurrence"

@celery.task(name="ingest_obis")
def ingest_obis(taxon: str = "Cetacea", limit: int = 100):
    """Pull species occurrences from OBIS and store in PostGIS."""
    
    print(f"Fetching {limit} records for taxon: {taxon}")
    
    try:
        response = requests.get(OBIS_URL, params={
            "taxon": taxon,
            "size": limit,
            "fields": "scientificName,vernacularName,decimalLongitude,decimalLatitude,depth,dataset"
        }, timeout=30)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"OBIS fetch failed: {e}")
        return {"status": "error", "message": str(e)}

    records = data.get("results", [])
    print(f"Got {len(records)} records from OBIS")

    saved = 0
    skipped = 0
    db = SessionLocal()

    try:
        for r in records:
            lat = r.get("decimalLatitude")
            lon = r.get("decimalLongitude")

            if lat is None or lon is None:
                skipped += 1
                continue

            obs = SpeciesObservation(
                species_name=r.get("scientificName", "Unknown"),
                common_name=r.get("vernacularName"),
                dataset="OBIS",
                depth_m=r.get("depth"),
                observed_at=datetime.datetime.utcnow(),
                location=WKTElement(f"POINT({lon} {lat})", srid=4326)
            )
            db.add(obs)
            saved += 1

        db.commit()
        print(f"Saved {saved} records, skipped {skipped} (no coordinates)")

    except Exception as e:
        db.rollback()
        print(f"DB save failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

    return {
        "status": "success",
        "taxon": taxon,
        "fetched": len(records),
        "saved": saved,
        "skipped": skipped
    }