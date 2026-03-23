import numpy as np
import pandas as pd
from database import SessionLocal
from sqlalchemy import text

def get_training_data() -> pd.DataFrame:
    """Pull joined fisheries + oceanography data for training."""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                f.species_name,
                f.fishing_zone,
                f.catch_kg,
                f.effort_hours,
                CASE WHEN f.effort_hours > 0
                    THEN f.catch_kg / f.effort_hours
                    ELSE 0
                END as cpue,
                o.temperature_c,
                o.salinity_ppt,
                o.chlorophyll,
                o.dissolved_oxygen,
                EXTRACT(MONTH FROM f.caught_at) as month,
                EXTRACT(DOY FROM f.caught_at) as day_of_year
            FROM fisheries_catches f
            LEFT JOIN oceanography_readings o ON (
                f.lat IS NOT NULL
                AND o.lat IS NOT NULL
                AND ABS(f.lat - o.lat) < 1.0
                AND ABS(f.lon - o.lon) < 1.0
            )
            WHERE f.effort_hours > 0 AND f.catch_kg IS NOT NULL
            LIMIT 5000
        """)).mappings().fetchall()
        return pd.DataFrame([dict(r) for r in result])
    finally:
        db.close()

def get_fisheries_only_data() -> pd.DataFrame:
    """Fallback — fisheries data without oceanography join."""
    db = SessionLocal()
    try:
        result = db.execute(text("""
            SELECT
                species_name,
                fishing_zone,
                catch_kg,
                effort_hours,
                CASE WHEN effort_hours > 0
                    THEN catch_kg / effort_hours
                    ELSE 0
                END as cpue,
                EXTRACT(MONTH FROM caught_at) as month,
                EXTRACT(DOY FROM caught_at) as day_of_year
            FROM fisheries_catches
            WHERE effort_hours > 0 AND catch_kg IS NOT NULL
        """)).mappings().fetchall()
        return pd.DataFrame([dict(r) for r in result])
    finally:
        db.close()

def train_stock_model():
    """Train XGBoost model to predict CPUE (stock health indicator)."""
    try:
        from xgboost import XGBRegressor
        from sklearn.preprocessing import LabelEncoder
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error, r2_score

        df = get_training_data()

        if len(df) < 5:
            df = get_fisheries_only_data()

        if len(df) < 3:
            return {
                "status": "insufficient_data",
                "message": "Need at least 3 fisheries records to train.",
                "tip": "Upload more fisheries CSV data."
            }

        df = df.fillna({
            "temperature_c": df["temperature_c"].median() if "temperature_c" in df and df["temperature_c"].notna().any() else 15.0,
            "salinity_ppt": df["salinity_ppt"].median() if "salinity_ppt" in df and df["salinity_ppt"].notna().any() else 34.0,
            "chlorophyll": df["chlorophyll"].median() if "chlorophyll" in df and df["chlorophyll"].notna().any() else 2.0,
            "dissolved_oxygen": df["dissolved_oxygen"].median() if "dissolved_oxygen" in df and df["dissolved_oxygen"].notna().any() else 7.5,
            "month": 6,
            "day_of_year": 180,
        })

        le_species = LabelEncoder()
        le_zone = LabelEncoder()
        df["species_enc"] = le_species.fit_transform(df["species_name"].astype(str))
        df["zone_enc"] = le_zone.fit_transform(df["fishing_zone"].astype(str).fillna("unknown"))

        feature_cols = ["species_enc", "zone_enc", "effort_hours", "month", "day_of_year"]
        for col in ["temperature_c", "salinity_ppt", "chlorophyll", "dissolved_oxygen"]:
            if col in df.columns:
                feature_cols.append(col)

        X = df[feature_cols].astype(float)
        y = df["cpue"].astype(float)

        if len(df) >= 6:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
        else:
            X_train, X_test, y_train, y_test = X, X, y, y

        model = XGBRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
            verbosity=0
        )
        model.fit(X_train, y_train)
        preds = model.predict(X_test)

        mae = round(float(mean_absolute_error(y_test, preds)), 3)
        r2 = round(float(r2_score(y_test, preds)), 3)

        feature_importance = dict(zip(feature_cols, [
            round(float(v), 4) for v in model.feature_importances_
        ]))

        return {
            "status": "success",
            "training_samples": len(df),
            "features_used": feature_cols,
            "model_performance": {
                "mae": mae,
                "r2_score": r2,
                "interpretation": "R² closer to 1.0 = better fit"
            },
            "feature_importance": feature_importance,
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


def predict_stock_health():
    """Predict stock health per species per zone using trained model."""
    try:
        from xgboost import XGBRegressor
        from sklearn.preprocessing import LabelEncoder

        df = get_training_data()
        if len(df) < 3:
            df = get_fisheries_only_data()
        if len(df) < 3:
            return {"status": "insufficient_data", "message": "Need more fisheries data."}

        df = df.fillna({
            "temperature_c": 15.0,
            "salinity_ppt": 34.0,
            "chlorophyll": 2.0,
            "dissolved_oxygen": 7.5,
            "month": 6,
            "day_of_year": 180,
        })

        le_species = LabelEncoder()
        le_zone = LabelEncoder()
        df["species_enc"] = le_species.fit_transform(df["species_name"].astype(str))
        df["zone_enc"] = le_zone.fit_transform(
            df["fishing_zone"].astype(str).fillna("unknown")
        )

        feature_cols = ["species_enc", "zone_enc", "effort_hours", "month", "day_of_year"]
        for col in ["temperature_c", "salinity_ppt", "chlorophyll", "dissolved_oxygen"]:
            if col in df.columns:
                feature_cols.append(col)

        X = df[feature_cols].astype(float)
        y = df["cpue"].astype(float)

        model = XGBRegressor(
            n_estimators=100, max_depth=4,
            learning_rate=0.1, random_state=42, verbosity=0
        )
        model.fit(X, y)

        groups = df.groupby(["species_name", "fishing_zone"]).agg({
            "effort_hours": "mean",
            "month": "mean",
            "day_of_year": "mean",
            **{col: "mean" for col in ["temperature_c", "salinity_ppt", "chlorophyll", "dissolved_oxygen"] if col in df.columns},
            "species_enc": "first",
            "zone_enc": "first",
            "cpue": "mean",
            "catch_kg": "sum",
        }).reset_index()

        X_pred = groups[feature_cols].astype(float)
        groups["predicted_cpue"] = model.predict(X_pred)

        max_cpue = groups["predicted_cpue"].max() or 1

        predictions = []
        for _, row in groups.iterrows():
            pred_cpue = float(row["predicted_cpue"])
            actual_cpue = float(row["cpue"])
            suitability = min(100, round((pred_cpue / max_cpue) * 100, 1))

            if pred_cpue < 30:
                risk = "high"
                recommendation = "Reduce fishing effort — stock under pressure"
            elif pred_cpue < 80:
                risk = "medium"
                recommendation = "Monitor closely — sustainable at current effort"
            else:
                risk = "low"
                recommendation = "Stock healthy — current practices sustainable"

            trend = "improving" if pred_cpue > actual_cpue else "declining"

            predictions.append({
                "species_name": row["species_name"],
                "fishing_zone": str(row["fishing_zone"]),
                "actual_cpue": round(actual_cpue, 2),
                "predicted_cpue": round(pred_cpue, 2),
                "trend": trend,
                "habitat_suitability_score": suitability,
                "depletion_risk": risk,
                "recommendation": recommendation,
                "total_catch_kg": round(float(row["catch_kg"]), 1),
            })

        predictions.sort(key=lambda x: x["predicted_cpue"])

        return {
            "status": "success",
            "model": "XGBoost CPUE predictor",
            "predictions_count": len(predictions),
            "predictions": predictions,
            "summary": {
                "high_risk_zones": sum(1 for p in predictions if p["depletion_risk"] == "high"),
                "medium_risk_zones": sum(1 for p in predictions if p["depletion_risk"] == "medium"),
                "low_risk_zones": sum(1 for p in predictions if p["depletion_risk"] == "low"),
            }
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


def predict_habitat_suitability():
    """Score each zone's habitat suitability for each observed species."""
    try:
        db = SessionLocal()
        result = db.execute(text("""
            SELECT
                s.species_name,
                s.common_name,
                AVG(o.temperature_c) as pref_temp,
                AVG(o.salinity_ppt) as pref_salinity,
                AVG(o.chlorophyll) as pref_chlorophyll,
                COUNT(s.id) as sightings
            FROM species_observations s
            JOIN oceanography_readings o ON (
                s.lat IS NOT NULL
                AND o.lat IS NOT NULL
                AND ABS(s.lat - o.lat) < 1.0
                AND ABS(s.lon - o.lon) < 1.0
            )
            WHERE s.species_name IS NOT NULL
            GROUP BY s.species_name, s.common_name
            HAVING COUNT(s.id) >= 1
        """)).mappings().fetchall()
        db.close()

        species_prefs = [dict(r) for r in result]

        if not species_prefs:
            db2 = SessionLocal()
            fallback = db2.execute(text("""
                SELECT species_name, common_name,
                       COUNT(*) as sightings,
                       AVG(depth_m) as avg_depth
                FROM species_observations
                WHERE species_name IS NOT NULL
                GROUP BY species_name, common_name
                ORDER BY sightings DESC LIMIT 10
            """)).mappings().fetchall()
            db2.close()
            return {
                "status": "partial",
                "message": "No spatial overlap between species and oceanography data. Upload CSVs from same region for full habitat scoring.",
                "species_summary": [dict(r) for r in fallback]
            }

        db3 = SessionLocal()
        zones = db3.execute(text("""
            SELECT DISTINCT fishing_zone,
                AVG(o.temperature_c) OVER (PARTITION BY f.fishing_zone) as zone_temp,
                AVG(o.salinity_ppt) OVER (PARTITION BY f.fishing_zone) as zone_salinity,
                AVG(o.chlorophyll) OVER (PARTITION BY f.fishing_zone) as zone_chlorophyll
            FROM fisheries_catches f
            JOIN oceanography_readings o ON (
                f.lat IS NOT NULL
                AND o.lat IS NOT NULL
                AND ABS(f.lat - o.lat) < 1.0
                AND ABS(f.lon - o.lon) < 1.0
            )
            WHERE f.fishing_zone IS NOT NULL
            LIMIT 20
        """)).mappings().fetchall()
        db3.close()

        zone_data = [dict(z) for z in zones]

        if not zone_data:
            return {
                "status": "partial",
                "message": "No zone-oceanography overlap found. Upload fisheries and oceanography CSVs from the same region.",
                "species_summary": species_prefs[:10]
            }

        habitat_scores = []
        for sp in species_prefs:
            for zone in zone_data:
                temp_diff = abs(
                    (sp.get("pref_temp") or 15) - (zone.get("zone_temp") or 15)
                )
                sal_diff = abs(
                    (sp.get("pref_salinity") or 34) - (zone.get("zone_salinity") or 34)
                )
                chl_diff = abs(
                    (sp.get("pref_chlorophyll") or 2) - (zone.get("zone_chlorophyll") or 2)
                )

                score = max(0, 100 - (temp_diff * 5) - (sal_diff * 2) - (chl_diff * 3))
                score = round(score, 1)

                habitat_scores.append({
                    "species_name": sp["species_name"],
                    "common_name": sp.get("common_name"),
                    "zone": zone["fishing_zone"],
                    "suitability_score": score,
                    "rating": "excellent" if score >= 80 else "good" if score >= 60 else "poor",
                    "pref_temp_c": round(float(sp.get("pref_temp") or 0), 1),
                    "zone_temp_c": round(float(zone.get("zone_temp") or 0), 1),
                })

        habitat_scores.sort(key=lambda x: x["suitability_score"], reverse=True)

        return {
            "status": "success",
            "habitat_scores": habitat_scores[:20],
            "total_scored": len(habitat_scores)
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}