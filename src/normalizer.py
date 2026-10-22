"""Roman Urdu text normalizer (starter version).

Roman Urdu has no standard spelling (acha / achha / accha), so we map
common variants to one canonical form. Extend VARIANTS as you annotate data.
"""
import re

VARIANTS = {
    "acha": ["acha", "achha", "accha", "achcha", "acchaa"],
    "bohot": ["bohot", "bohat", "bahut", "buhat", "bhot", "bht", "boht"],
    "nahi": ["nahi", "nahin", "nahe", "nhi", "nai", "nahee"],
    "kharab": ["kharab", "kharaab", "kharb", "khrab"],
    "bura": ["bura", "burra", "bora"],
    "bekar": ["bekar", "bekaar", "bakwas"],
    "delivery": ["delivery", "dilivery", "delivry", "delvery"],
    "paisa": ["paisa", "paisay", "paise", "pesay", "pese"],
    "shukriya": ["shukriya", "shukria", "shukriah"],
    "mehenga": ["mehenga", "mehnga", "mahanga", "mehengi", "mahenga"],
}

# reverse lookup: variant -> canonical
_LOOKUP = {v: canon for canon, vs in VARIANTS.items() for v in vs}


def _collapse(token: str, keep: int) -> str:
    return re.sub(r"(.)\1{%d,}" % keep, r"\1" * keep, token)


def normalize_token(token: str) -> str:
    if token in _LOOKUP:
        return _LOOKUP[token]
    two = _collapse(token, 2)
    if two in _LOOKUP:
        return _LOOKUP[two]
    one = _collapse(token, 1)
    if one in _LOOKUP:
        return _LOOKUP[one]
    return two


def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)      # urls
    text = re.sub(r"[^\w\s]", " ", text)                # punctuation / emoji
    tokens = [normalize_token(t) for t in text.split()]
    return " ".join(tokens)
