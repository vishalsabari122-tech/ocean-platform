from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from database import Base
import datetime

class SpeciesObservation(Base):
    __tablename__ = "species_observations"
    id            = Column(Integer, primary_key=True, index=True)
    species_name  = Column(String, nullable=False)
    common_name   = Column(String)
    dataset       = Column(String)
    depth_m       = Column(Float)
    abundance     = Column(Float)
    habitat_type  = Column(String)
    survey_method = Column(String)
    observed_at   = Column(DateTime, default=datetime.datetime.utcnow)
    notes         = Column(Text)
    lat           = Column(Float)
    lon           = Column(Float)

class OceanographyReading(Base):
    __tablename__ = "oceanography_readings"
    id               = Column(Integer, primary_key=True, index=True)
    temperature_c    = Column(Float)
    salinity_ppt     = Column(Float)
    depth_m          = Column(Float)
    dissolved_oxygen = Column(Float)
    chlorophyll      = Column(Float)
    current_speed    = Column(Float)
    ph               = Column(Float)
    dataset          = Column(String, default="upload")
    recorded_at      = Column(DateTime, default=datetime.datetime.utcnow)
    lat              = Column(Float)
    lon              = Column(Float)

class FisheriesCatch(Base):
    __tablename__ = "fisheries_catches"
    id           = Column(Integer, primary_key=True, index=True)
    species_name = Column(String)
    catch_kg     = Column(Float)
    effort_hours = Column(Float)
    vessel_id    = Column(String)
    gear_type    = Column(String)
    fishing_zone = Column(String)
    dataset      = Column(String, default="upload")
    caught_at    = Column(DateTime, default=datetime.datetime.utcnow)
    lat          = Column(Float)
    lon          = Column(Float)