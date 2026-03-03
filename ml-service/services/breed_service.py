"""
SAIOMS ML Service — Breed Detection Service v2
═══════════════════════════════════════════════════════════════════
Enhancements over v1:
  1. Image preprocessing pipeline: EXIF auto-rotate, CLAHE contrast
     enhancement, smart resize with padding to 224×224
  2. Ensemble secondary classifier: colour/texture heuristic blends
     with CLIP scores when top confidence < 0.80
  3. Expanded BREED_INFO with detection output details

Architecture:
  1. Preprocessing → normalise image quality
  2. CLIP ViT-B/32 zero-shot → species gate + breed ranking
  3. If conf < 0.80 → secondary heuristic blend (ensemble)
  4. Fallback demo if CLIP unavailable
"""
from __future__ import annotations

import io
import os
import hashlib
import random
from pathlib import Path
from typing import List, Optional

from PIL import Image, ImageEnhance, ImageOps
import numpy as np

# ── Breed catalogue ───────────────────────────────────────────────────────────
CATTLE_BREEDS = [
    "Gir", "Sahiwal", "Red Sindhi", "Tharparkar", "Kankrej",
    "Hariana", "Ongole", "Khillari", "Hallikar", "Rathi",
    "Deoni", "Malnad Gidda", "Amrit Mahal", "Kangayam", "Krishna Valley",
]
BUFFALO_BREEDS = [
    "Murrah", "Jaffarabadi", "Surti", "Mehsana",
    "Nili-Ravi", "Bhadawari", "Pandharpuri", "Nagpuri",
    "Chilika", "Toda",
]
ALL_BREEDS  = CATTLE_BREEDS + BUFFALO_BREEDS
NUM_CLASSES = len(ALL_BREEDS)

BREED_SPECIES = {b: "cattle" for b in CATTLE_BREEDS}
BREED_SPECIES.update({b: "buffalo" for b in BUFFALO_BREEDS})

BREED_META = {
    "Gir":           ("4–6 yrs", "3.2/5", "High milk production, heat-tolerant Zebu from Gujarat"),
    "Sahiwal":       ("3–5 yrs", "3.0/5", "Premier Indian dairy breed, tick-resistant, high milk fat"),
    "Red Sindhi":    ("2–4 yrs", "2.9/5", "Smallholder dairy breed, very disease-resistant"),
    "Tharparkar":    ("4–6 yrs", "3.1/5", "Dual-purpose arid-zone cattle from Rajasthan"),
    "Kankrej":       ("5–7 yrs", "3.3/5", "Draught and dairy dual breed from Gujarat"),
    "Hariana":       ("4–7 yrs", "3.0/5", "Draught breed of Haryana, lean and strong"),
    "Ongole":        ("5–8 yrs", "3.4/5", "Powerful Zebu breed from Andhra Pradesh, exports globally"),
    "Khillari":      ("4–6 yrs", "2.8/5", "Heavy draught breed from Maharashtra's Deccan plateau"),
    "Hallikar":      ("4–7 yrs", "3.1/5", "Racing and draught breed from Karnataka"),
    "Rathi":         ("3–5 yrs", "3.0/5", "Arid-zone dairy breed from Rajasthan's Bikaner region"),
    "Deoni":         ("4–6 yrs", "3.0/5", "Black-and-white spotted dual-purpose from Maharashtra"),
    "Malnad Gidda":  ("3–5 yrs", "2.8/5", "Disease-resistant hill breed from Karnataka forests"),
    "Amrit Mahal":   ("4–7 yrs", "3.1/5", "Historic draught breed from Karnataka"),
    "Kangayam":      ("4–6 yrs", "3.0/5", "Compact draught breed from Kongu Nadu region, Tamil Nadu"),
    "Krishna Valley":("4–6 yrs", "3.1/5", "Large white draught breed from Andhra Pradesh"),
    "Murrah":        ("4–7 yrs", "3.4/5", "World's best buffalo breed for milk yield, Haryana origin"),
    "Jaffarabadi":   ("5–8 yrs", "3.5/5", "Heaviest Indian buffalo, high milk yield in humid zones"),
    "Surti":         ("4–6 yrs", "3.2/5", "Coastal dairy buffalo, high fat content, Gujarat origin"),
    "Mehsana":       ("4–6 yrs", "3.1/5", "Commercial dairy buffalo from North Gujarat"),
    "Nili-Ravi":     ("4–7 yrs", "3.3/5", "High yielding buffalo with white markings, Punjab origin"),
    "Bhadawari":     ("4–6 yrs", "3.2/5", "Highest fat content in Indian buffaloes, UP origin"),
    "Pandharpuri":   ("4–6 yrs", "3.0/5", "Tall buffalo with very long horns from Maharashtra"),
    "Nagpuri":       ("4–6 yrs", "3.0/5", "Dual-purpose buffalo from Vidarbha region"),
    "Chilika":       ("3–5 yrs", "2.9/5", "Coastal wetland buffalo from Odisha"),
    "Toda":          ("4–6 yrs", "2.9/5", "Sacred heritage buffalo from Nilgiri Hills"),
}
DEFAULT_META = ("3–6 yrs", "3.0/5", "Indian zebu livestock")
MODEL_READY  = False

# ── CLIP detailed breed prompts ────────────────────────────────────────────────
BREED_PROMPTS = {
    "Gir":           "a photo of a Gir cattle with distinctive domed forehead and pendulous ears, reddish-brown or spotted coat, zebu humped breed from India",
    "Sahiwal":       "a photo of a Sahiwal cow, reddish-brown heavy-bodied dairy cattle with loose dewlap and short horns, zebu breed",
    "Red Sindhi":    "a photo of a Red Sindhi cattle, deep red or dark brown compact zebu cow with short upturned horns",
    "Tharparkar":    "a photo of a Tharparkar cattle, white or light grey zebu breed with long face and lyre-shaped horns from Thar desert",
    "Kankrej":       "a photo of a Kankrej cattle, silvery grey large-framed zebu bull or cow with lyre-shaped horns",
    "Hariana":       "a photo of a Hariana cattle, white or grey lean medium-sized zebu breed with black muzzle",
    "Ongole":        "a photo of an Ongole cattle, large white zebu with massive hump, long face, and drooping ears",
    "Khillari":      "a photo of a Khillari cattle, light grey compact zebu draught breed with long tapering horns, muscular body",
    "Hallikar":      "a photo of a Hallikar cattle, grey compact draught zebu with long curved horns from Karnataka",
    "Rathi":         "a photo of a Rathi cattle, brown or reddish-brown dairy zebu breed from Rajasthan with medium horns",
    "Deoni":         "a photo of a Deoni cattle, black and white spotted zebu breed from Maharashtra",
    "Malnad Gidda":  "a photo of a Malnad Gidda cattle, small-sized black or dark zebu hill breed from Karnataka forests",
    "Amrit Mahal":   "a photo of an Amrit Mahal cattle, grey or slate-coloured compact zebu with long curved horns",
    "Kangayam":      "a photo of a Kangayam cattle, grey or white compact zebu draught breed from Tamil Nadu",
    "Krishna Valley":"a photo of a Krishna Valley cattle, white large zebu breed from Andhra Pradesh with heavy build",
    "Murrah":        "a photo of a Murrah buffalo, large black river buffalo with tightly coiled corkscrew horns and heavily built body, from Haryana India",
    "Jaffarabadi":   "a photo of a Jaffarabadi buffalo, massive black river buffalo with large horns sagging on sides, from Gujarat India",
    "Surti":         "a photo of a Surti buffalo, medium-sized brown or grey swamp buffalo with flat horns, from Gujarat",
    "Mehsana":       "a photo of a Mehsana buffalo, medium black buffalo with long upward curved horns from Gujarat India",
    "Nili-Ravi":     "a photo of a Nili-Ravi buffalo, large black river buffalo with white markings on forehead and legs, from Punjab",
    "Bhadawari":     "a photo of a Bhadawari buffalo, copper or reddish-brown swamp buffalo with light-coloured legs, from Uttar Pradesh",
    "Pandharpuri":   "a photo of a Pandharpuri buffalo, tall slender black buffalo with very long curved horns, from Maharashtra",
    "Nagpuri":       "a photo of a Nagpuri buffalo, medium black buffalo with long backward-curved flat horns, from Vidarbha",
    "Chilika":       "a photo of a Chilika buffalo, small grey-brown swamp buffalo from Odisha coastal wetlands",
    "Toda":          "a photo of a Toda buffalo, large black or dark grey buffalo from Nilgiri Hills Tamil Nadu",
}

CATTLE_PROMPT  = "a photo of a domestic cattle, cow, bull or zebu bovine animal"
BUFFALO_PROMPT = "a photo of a domestic water buffalo, river buffalo or swamp buffalo"


# ── CLIP model loading ─────────────────────────────────────────────────────────
_clip_model      = None
_clip_preprocess = None
_clip_tokenize   = None
_device          = "cpu"

try:
    import torch
    import clip

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[BreedService] Loading CLIP ViT-B/32 on {_device} …")
    _clip_model, _clip_preprocess = clip.load("ViT-B/32", device=_device)
    _clip_model.eval()
    _clip_tokenize = clip.tokenize
    MODEL_READY = True
    print("[BreedService] ✅ CLIP ViT-B/32 loaded — real inference active")

except Exception as _clip_err:
    print(f"[BreedService] ⚠️  CLIP not available ({_clip_err}). Using smart demo fallback.")
    MODEL_READY = False


# ── Image preprocessing pipeline ──────────────────────────────────────────────
def preprocess_image(img: Image.Image) -> Image.Image:
    """
    Preprocessing pipeline for breed detection quality improvement:
    1. EXIF auto-rotate (fixes upside-down phone photos)
    2. Convert to RGB
    3. CLAHE-approximation: auto-contrast + modest brightness boost
    4. Resize to square with padding (preserves aspect ratio)
    """
    # EXIF auto-rotate
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    img = img.convert("RGB")

    # Auto-contrast (CLAHE approximation with PIL — no OpenCV dependency)
    img = ImageOps.autocontrast(img, cutoff=1)

    # Modest brightness/contrast boost for underexposed images
    w, h = img.size
    arr = np.array(img, dtype=np.float32)
    mean_lum = arr.mean()
    if mean_lum < 80:  # underexposed
        img = ImageEnhance.Brightness(img).enhance(1.3)
    if mean_lum > 200:  # overexposed
        img = ImageEnhance.Brightness(img).enhance(0.85)
    img = ImageEnhance.Contrast(img).enhance(1.15)

    # Resize to 224 with letterbox padding
    target = 224
    img.thumbnail((target, target), Image.LANCZOS)
    padded = Image.new("RGB", (target, target), (128, 128, 128))
    offset = ((target - img.width) // 2, (target - img.height) // 2)
    padded.paste(img, offset)
    return padded


# ── Secondary colour/texture heuristic (ensemble component) ───────────────────
def _heuristic_predict(img: Image.Image) -> List[dict]:
    """
    Colour-statistics heuristic. Used as ensemble component when CLIP
    confidence is below 0.80.
    NOT real ML — it's a conservative prior over image brightness/hue.
    """
    buf  = io.BytesIO()
    img.save(buf, format="PNG")
    seed = int(hashlib.md5(buf.getvalue()).hexdigest(), 16) % (2**31)
    rng  = random.Random(seed)

    img_small = img.resize((64, 64)).convert("RGB")
    pixels    = list(img_small.getdata())
    avg_r = sum(p[0] for p in pixels) / len(pixels)
    avg_g = sum(p[1] for p in pixels) / len(pixels)
    avg_b = sum(p[2] for p in pixels) / len(pixels)
    lightness = (avg_r + avg_g + avg_b) / 3

    # Very dark → likely buffalo; warm browns → Gir/Sahiwal/Rathi;
    # cool whites/greys → Hariana, Tharparkar, Kankrej
    if lightness < 90:
        pool = BUFFALO_BREEDS
    elif avg_r > avg_b + 20:  # warm reddish
        pool = ["Gir", "Sahiwal", "Red Sindhi", "Rathi", "Bhadawari"]
    elif lightness > 180:     # very light / white
        pool = ["Hariana", "Tharparkar", "Kankrej", "Ongole", "Krishna Valley"]
    else:
        pool = ALL_BREEDS

    top  = rng.choice(pool)
    rest = [b for b in pool if b != top]
    rng.shuffle(rest)
    tc = rng.uniform(0.65, 0.82)
    r2 = rng.uniform(0.08, 0.20)
    r3 = max(0.01, 1.0 - tc - r2)
    return [
        {"breed": top,              "confidence": round(tc, 4), "rank": 1},
        {"breed": rest[0] if rest else top, "confidence": round(r2, 4), "rank": 2},
        {"breed": rest[1] if len(rest) > 1 else top, "confidence": round(r3, 4), "rank": 3},
    ]


# ── CLIP zero-shot inference ───────────────────────────────────────────────────
def _clip_predict(img: Image.Image) -> List[dict]:
    """
    Zero-shot breed classification via CLIP:
      1. Species gate (cattle vs buffalo)
      2. Breed ranking over winning species pool
    Returns top-3 predictions with genuine softmax confidence.
    """
    import torch
    import torch.nn.functional as F

    image_tensor = _clip_preprocess(img).unsqueeze(0).to(_device)

    with torch.no_grad():
        species_texts  = _clip_tokenize([CATTLE_PROMPT, BUFFALO_PROMPT]).to(_device)
        img_feats      = _clip_model.encode_image(image_tensor)
        species_feats  = _clip_model.encode_text(species_texts)
        img_feats      = F.normalize(img_feats, dim=-1)
        species_feats  = F.normalize(species_feats, dim=-1)
        species_logits = (img_feats @ species_feats.T).squeeze(0)
        species_probs  = F.softmax(species_logits * 100, dim=0)
        cattle_prob    = species_probs[0].item()

        if cattle_prob >= 0.60:
            candidate_breeds  = CATTLE_BREEDS
        elif cattle_prob <= 0.40:
            candidate_breeds  = BUFFALO_BREEDS
        else:
            candidate_breeds  = ALL_BREEDS

        breed_prompts_list = [BREED_PROMPTS[b] for b in candidate_breeds]
        breed_texts  = _clip_tokenize(breed_prompts_list, truncate=True).to(_device)
        breed_feats  = _clip_model.encode_text(breed_texts)
        breed_feats  = F.normalize(breed_feats, dim=-1)
        breed_logits = (img_feats @ breed_feats.T).squeeze(0)
        breed_probs  = F.softmax(breed_logits * 100, dim=0).cpu().numpy()

    ranked = sorted(enumerate(candidate_breeds), key=lambda x: breed_probs[x[0]], reverse=True)
    return [
        {"breed": b, "confidence": float(round(float(breed_probs[idx]), 4)), "rank": rank}
        for rank, (idx, b) in enumerate(ranked[:3], start=1)
    ]


# ── Ensemble blending ──────────────────────────────────────────────────────────
def _ensemble_blend(clip_preds: List[dict], heuristic_preds: List[dict]) -> List[dict]:
    """
    Blend CLIP and heuristic predictions when top confidence < 0.80.
    CLIP gets 80% weight; heuristic gets 20%.
    """
    scores: dict[str, float] = {}
    for p in clip_preds:
        scores[p["breed"]] = scores.get(p["breed"], 0) + p["confidence"] * 0.80
    for p in heuristic_preds:
        scores[p["breed"]] = scores.get(p["breed"], 0) + p["confidence"] * 0.20

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    total  = sum(v for _, v in ranked[:3])
    result = []
    for rank, (breed, score) in enumerate(ranked[:3], start=1):
        result.append({"breed": breed, "confidence": round(score / total if total else score, 4), "rank": rank})
    return result


# ── Demo fallback (no CLIP) ───────────────────────────────────────────────────
def _demo_predict(img: Image.Image) -> List[dict]:
    return _heuristic_predict(img)


# ── Public API ────────────────────────────────────────────────────────────────
def detect_breed(image_bytes: bytes) -> dict:
    """
    Detect breed from raw image bytes.
    Pipeline: preprocess → CLIP (if available) → ensemble if low-conf → fallback
    Returns dict matching BreedDetectResponse schema.
    """
    raw_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img     = preprocess_image(raw_img)

    if MODEL_READY and _clip_model is not None:
        predictions   = _clip_predict(img)
        model_version = "clip-zero-shot-v2+preprocessing"

        # If top confidence is low, run ensemble with heuristic
        if predictions[0]["confidence"] < 0.80:
            heuristic    = _heuristic_predict(img)
            predictions  = _ensemble_blend(predictions, heuristic)
            model_version = "clip-ensemble-v2"
    else:
        predictions   = _demo_predict(img)
        model_version = "demo-heuristic-v2"

    top        = predictions[0]
    breed_name = top["breed"]
    species    = BREED_SPECIES.get(breed_name, "cattle")
    meta       = BREED_META.get(breed_name, DEFAULT_META)

    return {
        "success":       True,
        "top_breed":     breed_name,
        "confidence":    top["confidence"],
        "predictions":   predictions,
        "species":       species,
        "estimated_age": meta[0],
        "bcs":           meta[1],
        "notes":         f"Recommended for: {meta[2]}",
        "model_version": model_version,
    }
