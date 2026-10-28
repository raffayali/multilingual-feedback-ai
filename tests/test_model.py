from src.model import build_pipeline, predict_texts

TEXTS = [
    "bohot acha service", "kamal ka product", "mujhe pasand aya", "shandar delivery",
    "bakwas product", "bohot kharab packing", "paisa barbad", "bekar service",
    "order kal aya", "price kya hai", "parcel mil gaya", "address update kiya",
] * 4
LABELS = (["positive"] * 4 + ["negative"] * 4 + ["neutral"] * 4) * 4


def make_model():
    model = build_pipeline()
    model.fit(TEXTS, LABELS)
    return model


def test_predict_returns_valid_structure():
    out = predict_texts(make_model(), ["bohot acha product", "bakwas service"])
    assert len(out) == 2
    for r in out:
        assert r["label"] in {"positive", "negative", "neutral"}
        assert 0 <= r["confidence"] <= 1
        assert abs(sum(r["probabilities"].values()) - 1) < 0.01


def test_empty_input_gives_empty_list():
    assert predict_texts(make_model(), []) == []


def test_clear_examples_are_classified_correctly():
    out = predict_texts(make_model(), ["bohot acha service", "bakwas product"])
    assert out[0]["label"] == "positive"
    assert out[1]["label"] == "negative"
