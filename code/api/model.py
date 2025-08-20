from __future__ import annotations
from pathlib import Path
from typing import Literal, List, Any, Dict, Optional
from pydantic import BaseModel, Field


class Settings(BaseModel):
    API_PREFIX: str = "/api"
    DATA_PATH: Path = Path(__file__).with_name("flood_rainfall_geojson.geojson")

settings = Settings()

class RiskByNameResponse(BaseModel):
    kelurahan: str
    score: int = None
    # category: Optional[str] = None
    properties: Dict[str, Any] = {}
class GuidebookParams(BaseModel):
    kelurahan: str
    width_m: float
    length_m: float
    project_name: Optional[str] = "Gang Improvement"
    # Optional fine-tuning (defaults are provided if omitted)
    unit_cost_paving_idr_m2: Optional[int] = None
    unit_cost_drain_clean_idr_m: Optional[int] = None
    crew_prod_paving_m2_per_day: Optional[int] = None
    crew_prod_drain_m_per_day: Optional[int] = None

class RABParams(BaseModel):
    moduleNum: int
    lebar: float
    panjang: float

Surface = Literal["beton", "aspal", "tanah"]

class DesignRule(BaseModel):
    lebar: float
    surface: Surface                  # "beton" | "aspal" | "tanah"
    drainage: bool                    # true | false
    highFloodRisk: bool               # true -> risk score 3-5; false -> 1-2
    activity: bool               # normalized list, e.g. ["anak","orang",...]
    designModule: int                 # 1, 2, ...

class DesignRequest(BaseModel):
    lebar: float
    surface: Surface
    drainage: bool
    highFloodRisk: bool
    activity: List[str]

class DesignResponse(BaseModel):
    designModule: int
    matchedRule: DesignRule
    matchedBy: Literal["exact", "fallback-same-risk", "fallback-any-risk"]
    debug: Dict[str, str] = {}
