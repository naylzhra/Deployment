from __future__ import annotations
import json, os
import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Iterable
from model import DesignRule, Surface

from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
import io
from pathlib import Path

MATRIX_PATH: Path = Path(__file__).with_name("design_matrix.json")

@lru_cache(maxsize=1)
def load_matrix() -> List[DesignRule]:
    with open(MATRIX_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)

    normed: List[DesignRule] = []
    for r in rows:
        lebar = float(r.get("Lebar"))
        surface = str(r.get("Surface")).strip().lower()
        drainage = bool(r.get("Drainage"))
        high = bool(r.get("HighFloodRisk"))
        activity = bool(r.get("Activity", ""))
        design_module = int(r.get("DesignModule"))

        normed.append(
            DesignRule(
                lebar=lebar,
                surface=surface,
                drainage=drainage,
                highFloodRisk=high,
                activity=activity,
                designModule=design_module,
            )
        )
    return normed

# def score_to_category(score: Optional[float]) -> Optional[str]:
#     if score is None:
#         return None
#     try:
#         s = int(round(float(score)))
#     except Exception:
#         return None

#     if s <= 2:
#         return "Rendah"
#     if s == 3:
#         return "Sedang"
#     if s == 4:
#         return "Tinggi"
#     if s >= 5:
#         return "Sangat Tinggi"
#     return None


def _norm(s: str) -> str:
    return " ".join(s.strip().lower().split())


class GeoIndex:
    def __init__(self, features: List[Dict[str, Any]]):
        self.features = features

        names: List[str] = []
        seen_norm: set[str] = set()
        self.by_kelurahan: Dict[str, Dict[str, Any]] = {}

        for f in features:
            props = f.get("properties", {}) or {}
            name = props.get("kelurahan")
            if not isinstance(name, str):
                continue
            key = _norm(name)
            if key not in seen_norm:
                seen_norm.add(key)
                names.append(name)
                self.by_kelurahan[key] = f

        self.kelurahan_names = sorted(names, key=lambda x: x.lower())

    def search(self, q: Optional[str]) -> List[str]:
        if not q:
            return self.kelurahan_names
        nq = _norm(q)
        return [n for n in self.kelurahan_names if nq in _norm(n)]

    def get_by_kelurahan(self, kelurahan: str) -> Optional[Dict[str, Any]]:
        return self.by_kelurahan.get(_norm(kelurahan))


def load_geojson(path: Path) -> GeoIndex:
    if not path.exists():
        raise FileNotFoundError(f"GeoJSON not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    feats = data.get("features", [])
    if not isinstance(feats, list):
        raise ValueError("Invalid GeoJSON: 'features' must be a list")

    return GeoIndex(features=feats)

DEFAULTS = {
    "unit_cost_paving_idr_m2": 350_000,   # paving/concrete per m2
    "unit_cost_drain_clean_idr_m": 50_000,# drain cleaning per meter
    "crew_prod_paving_m2_per_day": 35,    # crew productivity (m2/day)
    "crew_prod_drain_m_per_day": 60,      # crew productivity (m/day)
}

def rupiah(n: float) -> str:
    # simple IDR format with thousands sep
    return f"Rp {int(round(n)):,.0f}".replace(",", ".")

def estimate_plan(width_m: float, length_m: float, score: Optional[int], overrides: Dict[str, Any] | None = None):
    cfg = DEFAULTS.copy()
    if overrides:
        for k, v in overrides.items():
            if v is not None and k in cfg:
                cfg[k] = v

    area_m2 = width_m * length_m

    # Cost model (tweak freely)
    cost_paving = area_m2 * cfg["unit_cost_paving_idr_m2"]
    cost_clean  = length_m * cfg["unit_cost_drain_clean_idr_m"]

    # Risk multiplier (example): raise budget for higher risk
    risk_mult = {None:1.0, 1:1.0, 2:1.05, 3:1.10, 4:1.20, 5:1.30}.get(score, 1.0)

    total_cost = (cost_paving + cost_clean) * risk_mult

    # Duration estimate (crew days)
    days_paving = math.ceil(area_m2 / cfg["crew_prod_paving_m2_per_day"]) if area_m2 > 0 else 0
    days_clean  = math.ceil(length_m / cfg["crew_prod_drain_m_per_day"]) if length_m > 0 else 0
    # add 20% overhead
    total_days  = math.ceil((days_paving + days_clean) * 1.2)

    return {
        "width_m": width_m,
        "length_m": length_m,
        "area_m2": area_m2,
        "unit_cost_paving_idr_m2": cfg["unit_cost_paving_idr_m2"],
        "unit_cost_drain_clean_idr_m": cfg["unit_cost_drain_clean_idr_m"],
        "cost_paving": cost_paving,
        "cost_clean": cost_clean,
        "risk_multiplier": risk_mult,
        "total_cost": total_cost,
        "days_paving": days_paving,
        "days_clean": days_clean,
        "total_days": total_days,
    }

def activities_overlap(wanted: Iterable[str] | None, rule_acts: Iterable[str]) -> bool:
    if not wanted:
        return True
    want = {w.strip().lower() for w in wanted if str(w).strip()}
    have = set(rule_acts)
    return not want.isdisjoint(have)

def choose_rule(req) -> tuple[DesignRule, str, Dict[str, str]]:
    rows = load_matrix()
    dbg: Dict[str, str] = {}
    if req.highFloodRisk is not None:
        high = bool(req.highFloodRisk)
        dbg["riskFlag"] = f"bool:{high}"
    else:
        high = None 

    exact = [
        r for r in rows
        if float(r.lebar) == float(req.lebar)
        and r.surface == req.surface
        and r.drainage == req.drainage
        and (high is None or r.highFloodRisk == high)
        and r.activity == (("pejalan" in req.activity) or ("kendaraan" in req.activity))
    ]
    if exact:
        return exact[0], "exact", dbg


    # if high is not None:
    #     same_risk = [
    #         r for r in rows
    #         if float(r.lebar) == float(req.lebar)
    #         and r.surface == req.surface
    #         and r.drainage == req.drainage
    #         and r.highFloodRisk == high
    #     ]
    #     if same_risk:
    #         dbg["activityNote"] = "no-overlap; ignored for fallback"
    #         return same_risk[0], "fallback-same-risk", dbg

    # # 3) ignore risk too
    # any_risk = [
    #     r for r in rows
    #     if float(r.lebar) == float(req.lebar)
    #     and r.surface == req.surface
    #     and r.drainage == req.drainage
    # ]
    # if any_risk:
    #     dbg["riskNote"] = "no-risk-match; fell back to any"
    #     return any_risk[0], "fallback-any-risk", dbg

    # # 4) relax width to nearest while keeping surface+drainage
    # candidates = [r for r in rows if r.surface == req.surface and r.drainage == req.drainage]
    # if candidates:
    #     best = min(candidates, key=lambda r: abs(float(r.lebar) - float(req.lebar)))
    #     dbg["widthNote"] = f"no-exact-width; chose nearest {best.lebar}"
    #     return best, "fallback-any-risk", dbg

    # # last resort
    return rows[0], "fallback-any-risk", {"warning": "no structural match; returned first"}

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io

def build_rab_pdf(*, moduleNum: int, lebar: float, panjang: float) -> bytes:
    """
    Build RAB PDF (landscape).
      1 -> Community Rainwater Harvesting (3000 L, for 8 modules)
      2 -> Infiltration Tank
      3 -> Mitigation (Signage)
      4 -> Vertical Garden
      5 -> Permeable Paving + Drainage

    Totals are scaled by (lebar/1.5)*(panjang/5)*moduleNum.
    """
    MODULE_NAME = {
        1: "Permeable Paving + Drainage",
        2: "Infiltration Tank",
        3: "Mitigation (Signage)",
        4: "Community Rainwater Harvesting",
        5: "Vertical Garden"

    }
    TABLES = {
        1: [
            ["Solusi", "Material", "Satuan", "Volume per modul (15m)", "Harga Satuan (Rp)", "Total Harga (Rp)"],
            ["Permeable Paving + Drainage", "Grass Block",               "m2",  60,   30_000, 1800_000],
            ["Permeable Paving + Drainage", "Pasir urug",                "m3",   0.5,  300_000,  150_000],
            ["Permeable Paving + Drainage", "U ditch (1x0.4) + Cover",   "unit", 5,  400_000,  2_000_000],
            ["Permeable Paving + Drainage", "Pipa drainage",             "m",    5,   60_000,  300_000],
        ],
        2: [
            ["Solusi", "Material", "Satuan", "Volume per modul (15m)", "Harga Satuan (Rp)", "Total Harga (Rp)"],
            ["Infiltration Tank", "Beton pracetak",  "m3",  1,    800_000,  800_000],
            ["Infiltration Tank", "Pipa perforasi",  "m",   5,     70_000,  350_000],
            ["Infiltration Tank", "Pasir + kerikil", "m3",  0.5,  350_000,  175_000],
            ["Infiltration Tank", "Geotekstil",      "m2",  5,    150_000,  750_000],
        ],
        3: [
            ["Solusi", "Material", "Satuan", "Volume per modul (15m)", "Harga Satuan (Rp)", "Total Harga (Rp)"],
            ["Mitigation (Signage)", "GRC (20×240 cm tebal 6 mm)", "m2",  5,     60_000, 300_000],
            ["Mitigation (Signage)", "Cat",                        "m2",  0.1,   85_000,   8_500],
            ["Mitigation (Signage)", "Paku",                       "kg",  0.5,   15_000,   7_500],
        ],
        4: [
            ["Solusi", "Material", "Satuan", "Volume per modul (15m)", "Harga Satuan (Rp)", "Total Harga (Rp)"],
            ["Community Rainwater Harvesting (3000 L, for 8 modules)", "Talang Air (125 meter x 100 mm)", "unit", 5,       50_000,   250_000],
            ["Community Rainwater Harvesting (3000 L, for 8 modules)", "Pipa PVC (Diameter 90 mm)",       "unit", 5, 50_000, 250_000],
            ["Community Rainwater Harvesting (3000 L, for 8 modules)", "Tangki Penampung 3000 L",         "unit", 0.125, 1_500_000, 187_500],
            ["Community Rainwater Harvesting (3000 L, for 8 modules)", "Kran Air",                         "unit", 0.5,        20_000,   10_000],
            ["Community Rainwater Harvesting (3000 L, for 8 modules)", "Filter 200-200L",                  "unit", 0.125,   800_000,  100_000],
            ["Community Rainwater Harvesting (3000 L, for 8 modules)", "Pompa 20-40L",                     "unit", 0.125, 3_000_000,  375_000],
        ],
        5: [
            ["Solusi", "Material", "Satuan", "Volume per modul (15m)", "Harga Satuan (Rp)", "Total Harga (Rp)"],
            ["Vertical Garden", "Wire Grid Wall",        "m2",  5,   300_000, 1_500_000],
            ["Vertical Garden", "Pot tanaman modular",  "unit", 2,   250_000,   500_000],
            ["Vertical Garden", "Media tanam + tanaman","m2",  2,   100_000,   200_000],
        ],
    }

    if moduleNum not in TABLES:
        raise ValueError(f"Unknown moduleNum: {moduleNum}. Expected 1..5")

    base_table = TABLES[moduleNum]

    def rupiah(n: float) -> str:
        return f"Rp {int(round(float(n))):,.0f}".replace(",", ".")

    scale = (lebar / 1) * (panjang / 5.0)

    styles = getSampleStyleSheet()
    small = ParagraphStyle("small", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=11)

    rows = [base_table[0][:]]
    grand = 0.0
    for r in base_table[1:]:
        total_scaled = float(r[5]) * scale
        grand += r[5]
        rows.append([
            Paragraph(str(r[0]), small),
            Paragraph(str(r[1]), small),
            r[2],
            r[3],
            rupiah(r[4]),
            rupiah(r[5]),
        ])
    rows.append(["", "", "", "", "TOTAL", rupiah(grand)])
    rows.append(["", "", "", "", f"TOTAL ({lebar}m x {panjang}m)", rupiah(grand*scale)])


    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=15*mm, rightMargin=15*mm, topMargin=14*mm, bottomMargin=14*mm,
    )
    page_w, _ = landscape(A4)
    avail = page_w - doc.leftMargin - doc.rightMargin
    col_widths = [0.26*avail, 0.30*avail, 0.08*avail, 0.14*avail, 0.11*avail, 0.11*avail]

    title = "Rencana Anggaran Biaya (RAB)"
    subtitle = f"Lebar Gang: {lebar:g} m   Panjang Gang: {panjang:g} m"
    namaModul = f"Modul: {MODULE_NAME[moduleNum]}"
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#3A54A0")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,0), 10),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("ALIGN", (2,1), (2,-2), "CENTER"),
        ("ALIGN", (3,1), (3,-2), "RIGHT"),
        ("ALIGN", (4,1), (5,-1), "RIGHT"),
        ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#E4F28F")),
        ("FONTNAME", (4,-1), (5,-1), "Helvetica-Bold"),
        ("SPAN", (0,-1), (3,-1)),
    ]))

    elements = [
        Paragraph(f"<b>{title}</b>", styles["Heading1"]),
        Paragraph(subtitle, styles["Normal"]),
        Paragraph(namaModul, styles["Normal"]),
        Spacer(1, 8),
        table,
    ]
    doc.build(elements)
    return buf.getvalue()
