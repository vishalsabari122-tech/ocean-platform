from fastapi import FastAPI, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, engine
import models
from models import SpeciesObservation, OceanographyReading, FisheriesCatch

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Ocean Platform API", version="0.3.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def root():
    return {"status": "Ocean Platform API running", "version": "0.3.1"}

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"database": "connected"}
    except Exception as e:
        return {"database": "error", "detail": str(e)}

@app.get("/observations")
def get_observations(db: Session = Depends(get_db)):
    obs = db.query(models.SpeciesObservation).limit(50).all()
    return {"count": len(obs), "results": [
        {"id": o.id, "species": o.species_name, "common_name": o.common_name,
         "dataset": o.dataset, "depth_m": o.depth_m, "observed_at": str(o.observed_at)}
        for o in obs
    ]}

@app.post("/ingest/obis/direct")
def ingest_obis_direct(taxon: str = "Cetacea", limit: int = 100):
    from tasks import ingest_obis
    return ingest_obis(taxon=taxon, limit=limit)

# ── CSV Upload endpoints ──────────────────────────────────

@app.post("/upload/oceanography")
async def upload_oceanography(file: UploadFile = File(...)):
    """Upload oceanography CSV — columns: date, lat, lon, temperature_c, salinity_ppt, depth_m, etc."""
    from upload import process_oceanography_csv
    contents = await file.read()
    return process_oceanography_csv(contents)

@app.post("/upload/fisheries")
async def upload_fisheries(file: UploadFile = File(...)):
    """Upload fisheries CSV — columns: date, lat, lon, species_name, catch_kg, effort_hours, etc."""
    from upload import process_fisheries_csv
    contents = await file.read()
    return process_fisheries_csv(contents)

@app.post("/upload/biodiversity")
async def upload_biodiversity(file: UploadFile = File(...)):
    """Upload biodiversity CSV — columns: date, lat, lon, species_name, common_name, abundance, etc."""
    from upload import process_biodiversity_csv
    contents = await file.read()
    return process_biodiversity_csv(contents)

# ── AI endpoints ──────────────────────────────────────────

@app.get("/ai/summary")
def get_summary():
    from analytics import species_summary
    return species_summary()

@app.get("/ai/anomalies")
def get_anomalies():
    from analytics import find_depth_anomalies
    return find_depth_anomalies()

@app.get("/ai/hotspots")
def get_hotspots():
    from analytics import find_biodiversity_hotspots
    return find_biodiversity_hotspots()

@app.post("/ai/ask")
def ask_question(question: str = "Which whale species are in the database?"):
    from ai_assistant import ask_claude
    return ask_claude(question)

# ── Cross-domain correlation endpoints ───────────────────

@app.get("/correlations/summary")
def correlation_summary():
    """Live counts across all three domains."""
    from correlations import cross_domain_summary
    return cross_domain_summary()

@app.get("/correlations/temperature-catch")
def temperature_catch():
    """How do temperature zones affect catch rates?"""
    from correlations import correlate_temperature_catch
    return correlate_temperature_catch()

@app.get("/correlations/species-environment")
def species_environment():
    """What environmental conditions do species prefer?"""
    from correlations import correlate_species_environment
    return correlate_species_environment()

@app.get("/correlations/fishing-pressure")
def fishing_pressure():
    """Which zones are overfished based on CPUE?"""
    from correlations import predict_fishing_pressure
    return predict_fishing_pressure()


# ── ML Prediction endpoints ───────────────────────────────

@app.get("/ml/train")
def train_model():
    """Train the XGBoost stock prediction model on current data."""
    from ml_models import train_stock_model
    return train_stock_model()

@app.get("/ml/predict/stock")
def predict_stock():
    """Predict stock health per species per zone."""
    from ml_models import predict_stock_health
    return predict_stock_health()

@app.get("/ml/predict/habitat")
def predict_habitat():
    """Score habitat suitability per species per zone."""
    from ml_models import predict_habitat_suitability
    return predict_habitat_suitability()


@app.get("/map/species")
def map_species(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT id, species_name, common_name, depth_m, dataset, observed_at, lat, lon
        FROM species_observations
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY observed_at DESC LIMIT 1000
    """)).mappings().fetchall()
    return {"count": len(result), "points": [dict(r) for r in result]}

@app.get("/map/oceanography")
def map_oceanography(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT id, temperature_c, salinity_ppt, chlorophyll,
               depth_m, dissolved_oxygen, recorded_at, lat, lon
        FROM oceanography_readings
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY recorded_at DESC LIMIT 500
    """)).mappings().fetchall()
    return {"count": len(result), "points": [dict(r) for r in result]}

@app.get("/map/fisheries")
def map_fisheries(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT id, species_name, catch_kg, effort_hours,
               fishing_zone, gear_type, caught_at, lat, lon
        FROM fisheries_catches
        WHERE lat IS NOT NULL AND lon IS NOT NULL
        ORDER BY caught_at DESC LIMIT 500
    """)).mappings().fetchall()
    return {"count": len(result), "points": [dict(r) for r in result]}
# ── Time-series endpoints ─────────────────────────────────

@app.get("/timeseries/temperature")
def timeseries_temperature(db: Session = Depends(get_db)):
    """Daily average temperature over time."""
    result = db.execute(text("""
        SELECT
            DATE(recorded_at) as date,
            ROUND(AVG(temperature_c)::numeric, 2) as avg_temp,
            ROUND(MIN(temperature_c)::numeric, 2) as min_temp,
            ROUND(MAX(temperature_c)::numeric, 2) as max_temp,
            ROUND(AVG(salinity_ppt)::numeric, 2) as avg_salinity,
            ROUND(AVG(chlorophyll)::numeric, 2) as avg_chlorophyll,
            ROUND(AVG(dissolved_oxygen)::numeric, 2) as avg_do,
            COUNT(*) as readings
        FROM oceanography_readings
        WHERE recorded_at IS NOT NULL AND temperature_c IS NOT NULL
        GROUP BY DATE(recorded_at)
        ORDER BY date ASC
        LIMIT 365
    """)).mappings().fetchall()
    return {"count": len(result), "data": [dict(r) for r in result]}

@app.get("/timeseries/catch")
def timeseries_catch(db: Session = Depends(get_db)):
    """Daily catch totals over time per species."""
    result = db.execute(text("""
        SELECT
            DATE(caught_at) as date,
            species_name,
            ROUND(SUM(catch_kg)::numeric, 2) as total_catch_kg,
            ROUND(AVG(catch_kg)::numeric, 2) as avg_catch_kg,
            ROUND(SUM(effort_hours)::numeric, 2) as total_effort,
            ROUND((SUM(catch_kg)/NULLIF(SUM(effort_hours),0))::numeric, 2) as daily_cpue,
            COUNT(*) as events
        FROM fisheries_catches
        WHERE caught_at IS NOT NULL AND catch_kg IS NOT NULL
        GROUP BY DATE(caught_at), species_name
        ORDER BY date ASC, total_catch_kg DESC
        LIMIT 500
    """)).mappings().fetchall()
    return {"count": len(result), "data": [dict(r) for r in result]}

@app.get("/timeseries/species")
def timeseries_species(db: Session = Depends(get_db)):
    """Cumulative species observations over time."""
    result = db.execute(text("""
        SELECT
            DATE(observed_at) as date,
            COUNT(*) as daily_observations,
            COUNT(DISTINCT species_name) as unique_species,
            SUM(COUNT(*)) OVER (ORDER BY DATE(observed_at)) as cumulative_observations
        FROM species_observations
        WHERE observed_at IS NOT NULL
        GROUP BY DATE(observed_at)
        ORDER BY date ASC
        LIMIT 365
    """)).mappings().fetchall()
    return {"count": len(result), "data": [dict(r) for r in result]}

@app.get("/timeseries/cpue-trend")
def timeseries_cpue(db: Session = Depends(get_db)):
    """CPUE trend over time — key stock health indicator."""
    result = db.execute(text("""
        SELECT
            DATE(caught_at) as date,
            ROUND(AVG(catch_kg / NULLIF(effort_hours, 0))::numeric, 2) as avg_cpue,
            ROUND(SUM(catch_kg)::numeric, 2) as total_catch,
            COUNT(*) as fishing_events
        FROM fisheries_catches
        WHERE caught_at IS NOT NULL
          AND effort_hours > 0
          AND catch_kg IS NOT NULL
        GROUP BY DATE(caught_at)
        ORDER BY date ASC
        LIMIT 365
    """)).mappings().fetchall()
    return {"count": len(result), "data": [dict(r) for r in result]}