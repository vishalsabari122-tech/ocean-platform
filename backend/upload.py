import pandas as pd
import numpy as np
from io import BytesIO
from database import SessionLocal
from models import OceanographyReading, FisheriesCatch, SpeciesObservation
from geoalchemy2.elements import WKTElement
import datetime

OCEAN_COLUMN_MAP = {
    "temperature": "temperature_c", "temp": "temperature_c",
    "temperature_c": "temperature_c", "sst": "temperature_c",
    "salinity": "salinity_ppt", "salinity_ppt": "salinity_ppt",
    "sal": "salinity_ppt",
    "depth": "depth_m", "depth_m": "depth_m",
    "oxygen": "dissolved_oxygen", "dissolved_oxygen": "dissolved_oxygen",
    "do": "dissolved_oxygen",
    "chlorophyll": "chlorophyll", "chl": "chlorophyll",
    "chla": "chlorophyll",
    "current": "current_speed", "current_speed": "current_speed",
    "ph": "ph",
    "lat": "lat", "latitude": "lat",
    "lon": "lon", "longitude": "lon", "long": "lon",
    "date": "date", "datetime": "date", "time": "date",
    "timestamp": "date",
}

FISHERIES_COLUMN_MAP = {
    "species": "species_name", "species_name": "species_name",
    "scientific_name": "species_name",
    "catch": "catch_kg", "catch_kg": "catch_kg",
    "weight": "catch_kg", "weight_kg": "catch_kg",
    "effort": "effort_hours", "effort_hours": "effort_hours",
    "hours": "effort_hours",
    "vessel": "vessel_id", "vessel_id": "vessel_id",
    "boat": "vessel_id",
    "gear": "gear_type", "gear_type": "gear_type",
    "zone": "fishing_zone", "fishing_zone": "fishing_zone",
    "area": "fishing_zone",
    "lat": "lat", "latitude": "lat",
    "lon": "lon", "longitude": "lon", "long": "lon",
    "date": "date", "datetime": "date", "time": "date",
    "timestamp": "date",
}

BIODIVERSITY_COLUMN_MAP = {
    "species": "species_name", "species_name": "species_name",
    "scientific_name": "species_name",
    "common": "common_name", "common_name": "common_name",
    "abundance": "abundance", "count": "abundance",
    "individuals": "abundance",
    "habitat": "habitat_type", "habitat_type": "habitat_type",
    "method": "survey_method", "survey_method": "survey_method",
    "depth": "depth_m", "depth_m": "depth_m",
    "lat": "lat", "latitude": "lat",
    "lon": "lon", "longitude": "lon", "long": "lon",
    "date": "date", "datetime": "date", "time": "date",
    "timestamp": "date",
}

def normalize_columns(df: pd.DataFrame, column_map: dict) -> pd.DataFrame:
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    rename = {}
    for col in df.columns:
        if col in column_map:
            rename[col] = column_map[col]
    return df.rename(columns=rename)

def safe_float(val):
    try:
        f = float(val)
        return None if np.isnan(f) else f
    except:
        return None

def safe_date(val):
    try:
        return pd.to_datetime(val).to_pydatetime()
    except:
        return datetime.datetime.utcnow()

def make_point(lat, lon):
    try:
        lat, lon = float(lat), float(lon)
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return WKTElement(f"POINT({lon} {lat})", srid=4326)
    except:
        pass
    return None

def process_oceanography_csv(contents: bytes) -> dict:
    df = pd.read_csv(BytesIO(contents))
    df = normalize_columns(df, OCEAN_COLUMN_MAP)
    db = SessionLocal()
    saved, skipped = 0, 0
    try:
        for _, row in df.iterrows():
            lat = row.get("lat")
            lon = row.get("lon")
            point = make_point(lat, lon) if lat is not None and lon is not None else None
            rec = OceanographyReading(
                temperature_c=safe_float(row.get("temperature_c")),
                salinity_ppt=safe_float(row.get("salinity_ppt")),
                depth_m=safe_float(row.get("depth_m")),
                dissolved_oxygen=safe_float(row.get("dissolved_oxygen")),
                chlorophyll=safe_float(row.get("chlorophyll")),
                current_speed=safe_float(row.get("current_speed")),
                ph=safe_float(row.get("ph")),
                recorded_at=safe_date(row.get("date")),
                dataset="upload",
                location=point,
            )
            db.add(rec)
            saved += 1
        db.commit()
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
    return {
        "status": "success", "domain": "oceanography",
        "rows_in_file": len(df), "saved": saved, "skipped": skipped,
        "columns_detected": list(df.columns),
    }

def process_fisheries_csv(contents: bytes) -> dict:
    df = pd.read_csv(BytesIO(contents))
    df = normalize_columns(df, FISHERIES_COLUMN_MAP)
    db = SessionLocal()
    saved, skipped = 0, 0
    try:
        for _, row in df.iterrows():
            lat = row.get("lat")
            lon = row.get("lon")
            point = make_point(lat, lon) if lat is not None and lon is not None else None
            rec = FisheriesCatch(
                species_name=str(row.get("species_name", "Unknown")),
                catch_kg=safe_float(row.get("catch_kg")),
                effort_hours=safe_float(row.get("effort_hours")),
                vessel_id=str(row.get("vessel_id", "")) if row.get("vessel_id") else None,
                gear_type=str(row.get("gear_type", "")) if row.get("gear_type") else None,
                fishing_zone=str(row.get("fishing_zone", "")) if row.get("fishing_zone") else None,
                caught_at=safe_date(row.get("date")),
                dataset="upload",
                location=point,
            )
            db.add(rec)
            saved += 1
        db.commit()
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
    return {
        "status": "success", "domain": "fisheries",
        "rows_in_file": len(df), "saved": saved, "skipped": skipped,
        "columns_detected": list(df.columns),
    }

def process_biodiversity_csv(contents: bytes) -> dict:
    df = pd.read_csv(BytesIO(contents))
    df = normalize_columns(df, BIODIVERSITY_COLUMN_MAP)
    db = SessionLocal()
    saved, skipped = 0, 0
    try:
        for _, row in df.iterrows():
            lat = row.get("lat")
            lon = row.get("lon")
            point = make_point(lat, lon) if lat is not None and lon is not None else None
            if not row.get("species_name"):
                skipped += 1
                continue
            rec = SpeciesObservation(
                species_name=str(row.get("species_name")),
                common_name=str(row.get("common_name")) if row.get("common_name") else None,
                abundance=safe_float(row.get("abundance")),
                habitat_type=str(row.get("habitat_type")) if row.get("habitat_type") else None,
                survey_method=str(row.get("survey_method")) if row.get("survey_method") else None,
                depth_m=safe_float(row.get("depth_m")),
                observed_at=safe_date(row.get("date")),
                dataset="upload",
                location=point,
            )
            db.add(rec)
            saved += 1
        db.commit()
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
    return {
        "status": "success", "domain": "biodiversity",
        "rows_in_file": len(df), "saved": saved, "skipped": skipped,
        "columns_detected": list(df.columns),
    }