# Multilingual Feedback Intelligence (English / Italian / Roman Urdu)

Thesis question: how well does a model trained on English and Italian data
transfer to low-resource Roman Urdu (cross-lingual transfer)?

## Week 1 checklist
- [ ] `python -m venv .venv` then activate, then `pip install -r requirements.txt`
- [ ] `pytest` (normalizer tests should pass)
- [ ] `python scripts/download_data.py` (English + Italian)
- [ ] Download Roman Urdu dataset (search "Roman Urdu Data Set UCI") and save as
      `data/raw/roman_urdu.csv`
- [ ] Read `docs/annotation_guidelines.md`, label first 200 of your own messages
- [ ] Run `notebooks/01_eda.ipynb`
- [ ] `git init`, first commit, push to GitHub

## Structure
```
data/        raw, processed, annotation (gitignored except annotation)
notebooks/   EDA and experiments
src/         reusable code (normalizer, models)
scripts/     download and utility scripts
tests/       pytest tests (SQA from day 1)
docs/        guidelines, notes for thesis
```

## Hardware note (i3, 8GB)
Heavy transformer fine-tuning later on Google Colab / Kaggle (free GPU).
Local: EDA, classical ML, web app, MySQL.
