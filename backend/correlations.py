from database import SessionLocal
from sqlalchemy import text

def cross_domain_summary() -> dict:
    db = SessionLocal()
    try:
        ocean = db.execute(text(
            "SELECT COUNT(*) as total, "
            "ROUND(AVG(temperature_c)::numeric,2) as avg_temp, "
            "ROUND(AVG(salinity_ppt)::numeric,2) as avg_salinity, "
            "ROUND(AVG(chlorophyll)::numeric,2) as avg_chlorophyll "
            "FROM oceanography_readings"
        )).mappings().fetchone()

        fisheries = db.execute(text(
            "SELECT COUNT(*) as total, "
            "ROUND(SUM(catch_kg)::numeric,2) as total_catch_kg, "
            "COUNT(DISTINCT species_name) as species_count, "
            "ROUND(AVG(effort_hours)::numeric,2) as avg_effort_hours "
            "FROM fisheries_catches"
        )).mappings().fetchone()

        biodiversity = db.execute(text(
            "SELECT COUNT(*) as total, "
            "COUNT(DISTINCT species_name) as unique_species, "
            "COUNT(DISTINCT habitat_type) as habitats "
            "FROM species_observations"
        )).mappings().fetchone()

        return {
            "oceanography": dict(ocean) if ocean else {},
            "fisheries": dict(fisheries) if fisheries else {},
            "biodiversity": dict(biodiversity) if biodiversity else {},
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

def correlate_temperature_catch() -> dict:
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                CASE
                    WHEN o.temperature_c < 15 THEN 'Cold (<15C)'
                    WHEN o.temperature_c < 20 THEN 'Moderate (15-20C)'
                    WHEN o.temperature_c < 25 THEN 'Warm (20-25C)'
                    ELSE 'Hot (>25C)'
                END as temp_zone,
                COUNT(DISTINCT f.id) as catch_events,
                ROUND(AVG(f.catch_kg)::numeric, 2) as avg_catch_kg,
                ROUND(AVG(o.temperature_c)::numeric, 2) as avg_temp
            FROM oceanography_readings o
            JOIN fisheries_catches f ON (
                ST_DWithin(o.location::geography, f.location::geography, 50000)
                AND ABS(EXTRACT(EPOCH FROM (o.recorded_at - f.caught_at))) < 86400
            )
            WHERE o.temperature_c IS NOT NULL AND f.catch_kg IS NOT NULL
            GROUP BY temp_zone
            ORDER BY avg_temp
        """)).mappings().fetchall()

        if not result:
            return {
                "status": "no_overlap",
                "message": "No spatial/temporal overlap between oceanography and fisheries data yet.",
                "tip": "Ensure your CSVs have overlapping lat/lon coordinates and dates."
            }

        return {
            "status": "success",
            "insight": "Temperature vs catch rate correlation",
            "data": [dict(r) for r in result]
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

def correlate_species_environment() -> dict:
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                s.species_name,
                s.common_name,
                COUNT(s.id) as sightings,
                ROUND(AVG(o.temperature_c)::numeric, 2) as avg_temp_c,
                ROUND(AVG(o.salinity_ppt)::numeric, 2) as avg_salinity,
                ROUND(AVG(o.chlorophyll)::numeric, 2) as avg_chlorophyll
            FROM species_observations s
            JOIN oceanography_readings o ON (
                ST_DWithin(s.location::geography, o.location::geography, 50000)
                AND ABS(EXTRACT(EPOCH FROM (s.observed_at - o.recorded_at))) < 86400
            )
            WHERE s.species_name IS NOT NULL
            GROUP BY s.species_name, s.common_name
            ORDER BY sightings DESC
            LIMIT 15
        """)).mappings().fetchall()

        if not result:
            return {
                "status": "no_overlap",
                "message": "No overlap between biodiversity and oceanography data yet.",
                "tip": "Upload oceanography and biodiversity CSVs covering the same region."
            }

        return {
            "status": "success",
            "insight": "Species environmental preferences",
            "data": [dict(r) for r in result]
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()

def predict_fishing_pressure() -> dict:
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                fishing_zone,
                species_name,
                COUNT(*) as events,
                ROUND(SUM(catch_kg)::numeric, 2) as total_catch_kg,
                ROUND(SUM(effort_hours)::numeric, 2) as total_effort_hours,
                ROUND((SUM(catch_kg) / NULLIF(SUM(effort_hours), 0))::numeric, 3) as cpue,
                CASE
                    WHEN (SUM(catch_kg) / NULLIF(SUM(effort_hours), 0)) < 50
                        THEN 'overfished'
                    WHEN (SUM(catch_kg) / NULLIF(SUM(effort_hours), 0)) < 150
                        THEN 'moderate'
                    ELSE 'healthy'
                END as stock_status
            FROM fisheries_catches
            WHERE fishing_zone IS NOT NULL AND effort_hours > 0
            GROUP BY fishing_zone, species_name
            ORDER BY cpue ASC
            LIMIT 20
        """)).mappings().fetchall()

        if not result:
            return {
                "status": "no_data",
                "message": "No fisheries data with zone and effort information yet.",
                "tip": "Upload a fisheries CSV with fishing_zone and effort_hours columns."
            }

        return {
            "status": "success",
            "insight": "Fishing pressure by zone (CPUE = catch kg per effort hour)",
            "explanation": "CPUE < 50 kg/hr suggests overfishing pressure",
            "data": [dict(r) for r in result]
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()