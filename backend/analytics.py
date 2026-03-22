from database import SessionLocal
from models import SpeciesObservation
from sqlalchemy import text
import statistics

def find_depth_anomalies() -> dict:
    """Find species observed at unusual depths using z-score."""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT id, species_name, common_name, depth_m
            FROM species_observations
            WHERE depth_m IS NOT NULL
            ORDER BY depth_m DESC
        """))
        rows = [dict(zip(result.keys(), r)) for r in result.fetchall()]

        if len(rows) < 5:
            return {"error": "Not enough depth data yet"}

        depths = [r["depth_m"] for r in rows]
        mean_d = statistics.mean(depths)
        stdev_d = statistics.stdev(depths)

        anomalies = []
        for r in rows:
            z = abs((r["depth_m"] - mean_d) / stdev_d) if stdev_d > 0 else 0
            if z > 2.0:
                anomalies.append({
                    **r,
                    "z_score": round(z, 2),
                    "mean_depth_m": round(mean_d, 1),
                    "flag": "deep anomaly" if r["depth_m"] > mean_d else "shallow anomaly"
                })

        return {
            "total_records_with_depth": len(rows),
            "mean_depth_m": round(mean_d, 1),
            "stdev_depth_m": round(stdev_d, 1),
            "anomalies_found": len(anomalies),
            "anomalies": anomalies[:20]
        }
    finally:
        db.close()

def find_biodiversity_hotspots() -> dict:
    """Find 5x5 degree grid cells with highest species diversity."""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                ROUND(ST_X(location)::numeric / 5) * 5 AS lon_grid,
                ROUND(ST_Y(location)::numeric / 5) * 5 AS lat_grid,
                COUNT(DISTINCT species_name) AS species_count,
                COUNT(*) AS total_observations,
                STRING_AGG(DISTINCT common_name, ', ')
                    FILTER (WHERE common_name IS NOT NULL) AS sample_species
            FROM species_observations
            WHERE location IS NOT NULL
            GROUP BY lon_grid, lat_grid
            HAVING COUNT(DISTINCT species_name) > 1
            ORDER BY species_count DESC
            LIMIT 10
        """))
        hotspots = [dict(zip(result.keys(), r)) for r in result.fetchall()]
        return {
            "hotspots_found": len(hotspots),
            "hotspots": hotspots
        }
    finally:
        db.close()

def species_summary() -> dict:
    """Get top species, depth stats, and dataset breakdown."""
    db = SessionLocal()
    try:
        top = db.execute(text("""
            SELECT species_name, common_name, COUNT(*) as observations
            FROM species_observations
            GROUP BY species_name, common_name
            ORDER BY observations DESC LIMIT 10
        """))
        top_species = [dict(zip(top.keys(), r)) for r in top.fetchall()]

        stats = db.execute(text("""
            SELECT
                COUNT(*) as total,
                COUNT(depth_m) as with_depth,
                COUNT(location) as with_location,
                ROUND(AVG(depth_m)::numeric, 1) as avg_depth,
                ROUND(MAX(depth_m)::numeric, 1) as max_depth
            FROM species_observations
        """))
        summary = dict(zip(stats.keys(), stats.fetchone()))

        return {"top_species": top_species, "summary": summary}
    finally:
        db.close()