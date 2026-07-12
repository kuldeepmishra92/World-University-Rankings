---
title: World University Rankings
emoji: 🏢
colorFrom: indigo
colorTo: gray
sdk: docker
pinned: false
license: mit
---

# World University Rankings — MCDM Framework

A capstone research project from **IIIT Lucknow** that builds a transparent, reproducible alternative to proprietary university ranking systems. Rankings are computed using a Multi-Criteria Decision Making (MCDM) pipeline — combining Shannon Entropy, AHP, and TOPSIS — applied to six years of Times Higher Education (THE) data.

## What This Is

Most university rankings are black boxes. Weights are undisclosed, methodology shifts year to year, and results are difficult to audit.

This project takes a different approach: every weight, every intermediate score, and every ranking decision is computed from open data and documented in code. The final MCDM rank is compared against the official THE ranking using Spearman and Kendall Tau correlation to validate accuracy.

**Coverage:** 2,453 universities · 119 countries · 2021–2026

## Methodology

The pipeline runs in four stages:

**1. Data Collection**
Raw data scraped from the Times Higher Education website for each year (2021–2026) using Python, requests, and BeautifulSoup. Five criteria are extracted per university: Teaching, Research Environment, Research Quality, Industry Impact, and International Outlook.

**2. Weight Calculation**
Two weighting methods are combined:
- **Shannon Entropy** — derives objective weights from the statistical variance in each criterion column. A criterion with higher spread across universities gets a higher weight.
- **AHP (Analytic Hierarchy Process)** — incorporates structured expert judgement through a pairwise comparison matrix. The two weight vectors are averaged to produce the final combined weights.

**3. TOPSIS Ranking**
Each university is scored using the Technique for Order Preference by Similarity to Ideal Solution. A closeness coefficient (0–1) is computed: 1 being closest to the ideal best, 0 being closest to the ideal worst. Universities are ranked by this coefficient.

**4. Validation**
MCDM rankings are validated against official THE rankings each year using:
- Spearman's rank correlation coefficient (ρ)
- Kendall's Tau (τ)
- Sensitivity analysis — testing ranking stability when individual weights are perturbed

Average Spearman correlation across all years: **0.9792**

## Application Features

| Page | Description |
|---|---|
| Overview | Summary stats, model accuracy chart, methodology breakdown |
| Rankings | Year-wise MCDM rankings table with country and score filters |
| Trends | Rank trajectory charts for top universities across 2021–2026 |
| Universities | Search any university · view year-by-year rank changes and criteria scores |
| Movers | Biggest rank climbers and fallers between consecutive years |
| Validation | Spearman and Kendall Tau charts, correlation tables |
| Predict Rank | Enter custom criteria scores to predict an estimated MCDM rank |

## Tech Stack

| Layer | Tools |
|---|---|
| Data scraping | Python · requests · BeautifulSoup |
| Analysis | pandas · NumPy · SciPy |
| MCDM computation | Custom Python implementation (entropy, AHP, TOPSIS) |
| Backend | Flask 3.0 |
| Frontend | Vanilla JS · Plotly.js · CSS Variables |
| Deployment | Docker · Hugging Face Spaces |

## Running Locally

```bash
# Clone and install
git clone <repo-url>
cd university_ranking
pip install -r requirements.txt

# Start the server
python app.py
# → http://localhost:7860
```
No environment variables required. All data files are included in the repository.

## Project Structure

```
university_ranking/
├── app.py                  # Flask API + routing
├── requirements.txt
├── Dockerfile
├── templates/
│   └── index.html          # Single-page application
├── static/
│   ├── style.css
│   └── app.js
├── Cleaned_data--/         # Raw cleaned CSVs (2021–2026)
├── Result_by_year/         # MCDM result CSVs (2021–2026)
├── weights/                # Computed weight JSONs (2021–2026)
└── Notebook_code/          # Jupyter notebooks (per-year analysis)
```

## Author

**Kuldeep Kumar Mishra** (MSD24006) — MSc Data Science, IIIT Lucknow  
Capstone Project · 2024–2025

Data sourced from Times Higher Education World University Rankings. This project is for academic research purposes.
