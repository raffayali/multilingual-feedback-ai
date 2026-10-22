# Annotation Guidelines (Roman Urdu feedback)

Collect 1,000 to 2,000 real messages/reviews (Daraz, Google Maps, food apps,
friends/family with permission). **Remove names, phone numbers, addresses.**

Save as `data/annotation/roman_urdu_labeled.csv` with columns:

| column | values |
|---|---|
| text | the original message |
| sentiment | positive / neutral / negative |
| topic | delivery / price / quality / staff / refund / other |
| urgency | low / medium / high |

## Rules
- **sentiment:** judge the customer's overall feeling, not one word.
- **topic:** pick the main issue only. If unclear, use `other`.
- **urgency = high** if: refund/fraud/safety issue, or customer threatens to leave.
- Sarcasm: label by the real meaning (e.g. "wah kya service hai" after a bad
  experience is negative).
- Ask a friend to label 200 of the same messages. Measure agreement
  (Cohen's kappa). This number goes in your thesis.
