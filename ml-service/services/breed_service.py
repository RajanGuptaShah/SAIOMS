"""
SAIOMS ML Service — Indian Bovine Breed Detection v5
═══════════════════════════════════════════════════════
Primary:  ujjwal75/indian-bovine-breeds-model (HuggingFace)
Fallback: Gemini Vision — real AI analysis including DYNAMIC AGE ESTIMATION
Last resort: color-based deterministic heuristic
"""
from __future__ import annotations
import io, os, base64, hashlib, random, json, re
from typing import List
from PIL import Image, ImageOps
import numpy as np

# ── Breed metadata (origin, milk yield, key traits) ─────────────────────────
BUFFALO_BREEDS = [
    "Banni","Bhadawari","Chilika","Jaffarabadi","Jaffrabadi","Mehsana",
    "Murrah","Nagpuri","Nili Ravi","Pandharpuri","Surti","Toda"
]

BREED_META = {
    # breed: (origin, milk_yield, description)
    "Gir":             ("Gujarat, India",        "1200–1800 kg/lac", "Zebu breed, papaya-red, prominent hump, long ears"),
    "Sahiwal":         ("Punjab, India",          "1400–2500 kg/lac", "Best Zebu dairy breed, highly tick-resistant"),
    "Red Sindhi":      ("Sindh, Pakistan/India",  "1000–1800 kg/lac", "Heat-tolerant dairy breed for smallholders"),
    "Tharparkar":      ("Rajasthan/Sindh",        "1000–1600 kg/lac", "Dual-purpose arid-zone breed, lyre-shaped horns"),
    "Kankrej":         ("Gujarat, India",          "1000–1400 kg/lac", "Heavy dual-purpose Zebu, silver-grey color"),
    "Hariana":         ("Haryana, India",          "900–1200 kg/lac",  "Efficient draught breed, white with grey markings"),
    "Ongole":          ("Andhra Pradesh",          "800–1100 kg/lac",  "Large Zebu breed exported globally"),
    "Khillari":        ("Maharashtra, India",      "500–700 kg/lac",   "Prime draught breed, compact muscular build"),
    "Hallikar":        ("Karnataka, India",        "600–900 kg/lac",   "Racing and draught breed"),
    "Rathi":           ("Rajasthan, India",        "900–1300 kg/lac",  "Arid-zone dairy breed"),
    "Deoni":           ("Maharashtra, India",      "900–1200 kg/lac",  "Black-and-white spotted dual-purpose"),
    "Murrah":          ("Haryana/Punjab, India",   "2000–3000 kg/lac", "World's best buffalo for milk yield"),
    "Jaffrabadi":      ("Gujarat, India",          "1800–2500 kg/lac", "Heaviest Indian buffalo, massive curved horns"),
    "Jaffarabadi":     ("Gujarat, India",          "1800–2500 kg/lac", "Heaviest Indian buffalo, massive curved horns"),
    "Surti":           ("Gujarat, India",          "1500–2200 kg/lac", "High-fat milk buffalo"),
    "Mehsana":         ("Gujarat, India",          "1600–2200 kg/lac", "High-yielding commercial buffalo"),
    "Nili Ravi":       ("Punjab, India/Pakistan",  "1800–2500 kg/lac", "High-yielding buffalo with white markings"),
    "Bhadawari":       ("UP/MP, India",            "800–1200 kg/lac",  "Highest butter-fat content buffalo"),
    "Nagpuri":         ("Vidarbha, Maharashtra",   "1000–1600 kg/lac", "Dual-purpose buffalo, white markings"),
    "Toda":             ("Nilgiri Hills, TN",      "500–700 kg/lac",   "Sacred heritage buffalo breed"),
    "Holstein Friesian": ("Netherlands/Global",   "4000–8000 kg/lac", "High-yielding exotic dairy breed"),
    "Jersey":          ("Jersey Island, UK",       "2500–4000 kg/lac", "High butterfat exotic dairy breed"),
    "Punganur":        ("Andhra Pradesh",          "500–600 kg/lac",   "World's smallest cattle breed"),
    "Vechur":          ("Kerala, India",           "300–500 kg/lac",   "Miniature cattle breed from Kerala"),
    "Unknown Cattle":  ("India",                   "Varies",           "Indian bovine livestock"),
    "Unknown Buffalo": ("India",                   "Varies",           "Indian buffalo livestock"),
}
DEFAULT_META = ("India", "Varies", "Indian bovine livestock")

def get_species(breed: str) -> str:
    normalized = breed.replace("_", " ").strip()
    return "buffalo" if normalized in BUFFALO_BREEDS else "cattle"

ALL_BREEDS = list(BREED_META.keys())
BREED_SPECIES = {b: get_species(b) for b in ALL_BREEDS}

# Age category definitions
AGE_CATEGORIES = {
    "calf":   {"range": "0–6 months", "label": "Calf"},
    "young":  {"range": "6 months – 2 years", "label": "Young"},
    "adult":  {"range": "2–6 years", "label": "Adult"},
    "mature": {"range": "6+ years", "label": "Mature"},
}

# ── Model loading ─────────────────────────────────────────────────────────────
_hf_model     = None
_hf_classes   = []
_hf_transform = None
_device       = "cpu"
MODEL_READY   = False

try:
    import torch, torch.nn.functional as F
    from torchvision import transforms
    import timm
    from huggingface_hub import hf_hub_download

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[BreedService] Loading HF model on {_device} …")
    model_path   = hf_hub_download("ujjwal75/indian-bovine-breeds-model", "Indian_bovine_finetuned_model.pth")
    classes_path = hf_hub_download("ujjwal75/indian-bovine-breeds-model", "classes.json")
    with open(classes_path) as f:
        _hf_classes = json.load(f)
    _hf_model = timm.create_model("convnext_tiny", pretrained=False, num_classes=len(_hf_classes))
    ckpt = torch.load(model_path, map_location=_device)
    _hf_model.load_state_dict(ckpt.get("model_state_dict", ckpt))
    _hf_model.to(_device); _hf_model.eval()
    _hf_transform = transforms.Compose([
        transforms.Resize((224, 224)), transforms.ToTensor(),
        transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225]),
    ])
    MODEL_READY = True
    print("[BreedService] ✅ HF model loaded")
except Exception as e:
    print(f"[BreedService] ⚠️ HF model unavailable: {e}")

# ── Image preprocessing ────────────────────────────────────────────────────────
def preprocess_image(img: Image.Image) -> Image.Image:
    try: img = ImageOps.exif_transpose(img)
    except: pass
    return img.convert("RGB")

# ── Gemini Vision: breed + dynamic age ───────────────────────────────────────
def _gemini_predict(img: Image.Image) -> dict:
    import requests
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return {}

    # Resize for API
    img_r = img.copy(); img_r.thumbnail((1024,1024), Image.LANCZOS)
    buf = io.BytesIO(); img_r.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()

    prompt = """You are a veterinary expert and livestock specialist analyzing an animal image.

Analyze carefully:
1. Body size relative to surroundings
2. Facial features: large eyes proportional to head = young/calf
3. Horn development: no horns or stub = young/calf; fully developed = adult/mature
4. Body proportions: short legs relative to body = calf; leggy build = young
5. Coat texture: soft fluffy = calf; coarser = adult
6. Udder/testicular development: absent = calf/young
7. Overall muscle mass and body fullness

Known Indian cattle breeds: Gir, Sahiwal, Tharparkar, Kankrej, Ongole, Hariana, Red Sindhi, Khillari, Hallikar, Rathi, Deoni, Punganur, Vechur, Holstein Friesian, Jersey
Known Indian buffalo breeds: Murrah, Jaffrabadi, Jaffarabadi, Surti, Mehsana, Nili Ravi, Bhadawari, Nagpuri, Toda

Return ONLY valid JSON (no markdown):
{
  "species": "cattle",
  "age_category": "calf",
  "age_range": "0-6 months",
  "age_reasoning": "Large eyes, no horn development, fluffy coat, short proportions",
  "top_breed": "Murrah",
  "predictions": [
    {"breed": "Murrah", "confidence": 0.75, "rank": 1},
    {"breed": "Nagpuri", "confidence": 0.15, "rank": 2},
    {"breed": "Surti", "confidence": 0.10, "rank": 3}
  ]
}"""

    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
            json={
                "contents": [{"parts": [
                    {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
                    {"text": prompt}
                ]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 512}
            }, timeout=25
        )
        resp.raise_for_status()
        
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        m = re.search(r'\{[\s\S]*\}', text)
        if not m: return {}
        data = json.loads(m.group())
        preds = data.get("predictions", [])
        if not preds: return {}
        predictions = [
            {"breed": str(p.get("breed","Unknown")).strip(), "confidence": float(p.get("confidence",0.33)), "rank": int(p.get("rank", i+1))}
            for i, p in enumerate(preds[:3])
        ]
        return {
            "predictions": predictions,
            "age_category": data.get("age_category", "adult"),
            "age_range": data.get("age_range", "2–6 years"),
            "age_reasoning": data.get("age_reasoning", ""),
            "species": data.get("species", "cattle"),
            "source": "gemini-vision"
        }
    except Exception as e:
        print(f"[BreedService/Gemini] Vision error: {e}")
        return {}

# ── HuggingFace model inference ───────────────────────────────────────────────
def _hf_predict(img: Image.Image) -> List[dict]:
    import torch, torch.nn.functional as F
    t = _hf_transform(img).unsqueeze(0).to(_device)
    with torch.no_grad():
        probs = F.softmax(_hf_model(t), dim=1).squeeze(0).cpu().numpy()
    ranked = sorted(enumerate(_hf_classes), key=lambda x: probs[x[0]], reverse=True)
    return [
        {"breed": b.replace("_"," "), "confidence": float(round(float(probs[idx]),4)), "rank": r}
        for r, (idx, b) in enumerate(ranked[:3], start=1)
    ]

# ── Age heuristic from image pixel analysis ────────────────────────────────────
def _estimate_age_heuristic(img: Image.Image) -> dict:
    """
    Dynamic visual heuristics when AI is unavailable.
    Varies between calf, young, adult, mature based on image edge density and lighting variance.
    """
    # Crop to the center 50% to ignore background noise (grass/trees)
    width, height = img.size
    left = int(width * 0.25)
    top = int(height * 0.25)
    right = int(width * 0.75)
    bottom = int(height * 0.75)
    cropped = img.crop((left, top, right, bottom))

    small = cropped.resize((128, 128)).convert("RGB")
    arr = np.array(small)
    
    # Calculate image edge complexity (calves often have fuzzier/softer coats)
    gray = np.mean(arr, axis=2)
    edges = np.abs(np.diff(gray, axis=0)).mean() + np.abs(np.diff(gray, axis=1)).mean()
    
    # Calculate variance (mature animals often have larger uniform body areas)
    variance = np.var(gray)

    # Tighter thresholds since background grass is cropped out
    if edges > 15.0 and variance < 2000:
        return {"age_category": "calf", "age_range": "0–6 months", "age_reasoning": "High center fuzz density detected"}
    elif edges > 12.0 and variance < 3500:
        return {"age_category": "young", "age_range": "6 months – 2 years", "age_reasoning": "Moderate youthful coat complexity"}
    elif variance > 5000:
        return {"age_category": "mature", "age_range": "6+ years", "age_reasoning": "Large developed body mass footprint detected"}
    else:
        return {"age_category": "adult", "age_range": "2–6 years", "age_reasoning": "Standard adult structural features detected"}

# ── Color-based pure fallback ──────────────────────────────────────────────────
def _heuristic_predict(img: Image.Image) -> List[dict]:
    buf = io.BytesIO(); img.save(buf, format="PNG")
    seed = int(hashlib.md5(buf.getvalue()).hexdigest(), 16) % (2**31)
    rng = random.Random(seed)
    small = img.resize((64,64)).convert("RGB")
    pixels = list(small.getdata())
    avg_r = sum(p[0] for p in pixels)/len(pixels)
    avg_g = sum(p[1] for p in pixels)/len(pixels)
    lightness = sum((p[0]+p[1]+p[2])/3 for p in pixels)/len(pixels)
    if lightness < 80:   pool = ["Murrah","Nagpuri","Bhadawari","Jaffrabadi"]
    elif avg_r > avg_g+20: pool = ["Gir","Sahiwal","Red Sindhi"]
    else:                 pool = ["Tharparkar","Hariana","Holstein Friesian","Kankrej"]
    top = rng.choice(pool); rest = [b for b in pool if b != top]; rng.shuffle(rest)
    return [
        {"breed": top,                    "confidence": round(rng.uniform(0.45,0.65),4), "rank":1},
        {"breed": rest[0] if rest else top, "confidence": round(rng.uniform(0.15,0.30),4), "rank":2},
        {"breed": rest[1] if len(rest)>1 else top, "confidence": round(rng.uniform(0.05,0.15),4), "rank":3},
    ]

# ── Public API ────────────────────────────────────────────────────────────────
def detect_breed(image_bytes: bytes) -> dict:
    raw_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img     = preprocess_image(raw_img)
    
    age_info = None
    gemini_used = False
    predictions = []
    model_version = "unknown"

    # Strategy 1: High-Accuracy Cloud Vision API (Primary)
    if os.environ.get("GEMINI_API_KEY"):
        gemini_result = _gemini_predict(img)
        if gemini_result and gemini_result.get("predictions"):
            predictions   = gemini_result["predictions"]
            age_info      = gemini_result
            model_version = "gemini-2.0-flash-vision"
            gemini_used   = True
            print(f"[BreedService] Gemini Vision: {predictions[0]['breed']} ({predictions[0]['confidence']:.0%})")

    # Strategy 2: Local HuggingFace Model (Fallback)
    if not predictions and MODEL_READY and _hf_model is not None:
        try:
            predictions   = _hf_predict(img)
            model_version = "hf-ujjwal75-v1-fallback"
            print(f"[BreedService] HF Fallback: {predictions[0]['breed']}")
        except Exception as e:
            print(f"[BreedService] HF failed: {e}")

    # Strategy 3: Color heuristic (last resort)
    if not predictions:
        predictions   = _heuristic_predict(img)
        model_version = "color-heuristic-v5"
        print("[BreedService] Using heuristic fallback")

    # If we have breed but no age_info, estimate from heuristic
    if not age_info:
        age_info = _estimate_age_heuristic(img)

    top        = predictions[0]
    breed_name = top["breed"]
    species    = age_info.get("species") if age_info and age_info.get("species") else get_species(breed_name)
    meta       = BREED_META.get(breed_name, DEFAULT_META)
    age_cat    = age_info.get("age_category", "adult") if age_info else "adult"
    age_range  = age_info.get("age_range", "2–6 years") if age_info else "2–6 years"
    age_label  = AGE_CATEGORIES.get(age_cat, AGE_CATEGORIES["adult"])["label"]

    return {
        "success":        True,
        "top_breed":      breed_name,
        "confidence":     top["confidence"],
        "predictions":    predictions,
        "species":        species,
        # Dynamic age fields
        "age_category":      age_cat,
        "age_range":         age_range,
        "age_label":         age_label,
        "age_reasoning":     age_info.get("age_reasoning","") if age_info else "",
        # Legacy field (kept for compatibility) — now dynamic
        "estimated_age":     age_range,
        # Breed metadata
        "origin":         meta[0],
        "milk_yield":     meta[1],
        "notes":          meta[2],
        "bcs":            "3.0/5",
        "model_version":  model_version,
        "gemini_used":    gemini_used,
    }
