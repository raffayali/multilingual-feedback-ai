from src.normalizer import normalize


def test_spelling_variants_map_to_one_form():
    assert normalize("achha") == normalize("accha") == "acha"


def test_repeated_letters_collapsed():
    assert normalize("Bohottt ACHA!!!") == "bohot acha"


def test_punctuation_and_urls_removed():
    assert normalize("delivery late thi... http://x.com") == "delivery late thi"


def test_unknown_words_kept():
    assert normalize("packing") == "packing"


def test_empty_string():
    assert normalize("") == ""
