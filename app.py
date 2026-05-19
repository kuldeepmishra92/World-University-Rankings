from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
import json
import os
from scipy.stats import spearmanr

app = Flask(__name__)

# ─────────────────────────────────────────
# CONFIG — folder paths
# ─────────────────────────────────────────
RESULTS_DIR = "Result_by_year"
WEIGHTS_DIR = "weights"
YEARS       = [2021, 2022, 2023, 2024, 2025, 2026]
CRITERIA    = ['teaching', 'research_env', 'research_qual', 'industry', 'intl_outlook']
CRITERIA_LABELS = ['Teaching', 'Research Environment', 'Research Quality', 'Industry Impact', 'International Outlook']

# ─────────────────────────────────────────
# FIX #3 — In-memory cache (avoid re-reading CSV on every request)
# ─────────────────────────────────────────
_year_cache   = {}   # {year: DataFrame}
_all_df_cache = None # combined DataFrame


# ─────────────────────────────────────────
# HELPER — Load single year data
# ─────────────────────────────────────────
def load_year(year):
    if year not in _year_cache:
        path = os.path.join(RESULTS_DIR, f"{year}_mcdm_results.csv")
        df   = pd.read_csv(path)
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        _year_cache[year] = df
    return _year_cache[year]


# ─────────────────────────────────────────
# HELPER — Load all years combined
# ─────────────────────────────────────────
def load_all_years():
    global _all_df_cache
    if _all_df_cache is None:
        frames = []
        for year in YEARS:
            df = load_year(year).copy()
            df['year'] = year
            frames.append(df)
        _all_df_cache = pd.concat(frames, ignore_index=True)
    return _all_df_cache


# ─────────────────────────────────────────
# HELPER — Load weights for a year
# ─────────────────────────────────────────
def load_weights(year):
    path = os.path.join(WEIGHTS_DIR, f"weights_{year}.json")
    with open(path, 'r') as f:
        return json.load(f)


# ─────────────────────────────────────────
# HELPER — TOPSIS function
# ─────────────────────────────────────────
def topsis(norm_matrix, weights):
    weighted    = norm_matrix * weights
    ideal_best  = weighted.max(axis=0)
    ideal_worst = weighted.min(axis=0)
    d_best      = np.sqrt(((weighted - ideal_best)  ** 2).sum(axis=1))
    d_worst     = np.sqrt(((weighted - ideal_worst) ** 2).sum(axis=1))
    closeness   = d_worst / (d_best + d_worst)
    return closeness


# ═══════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════

# ── Home ──────────────────────────────────
@app.route('/')
def home():
    return render_template('index.html')


# ── API: Summary stats for home page ──────
@app.route('/api/summary')
def summary():
    all_df = load_all_years()
    total_universities = all_df['university'].nunique()
    total_countries    = all_df['country'].nunique()

    # Spearman per year
    spearman_scores = []
    for year in YEARS:
        df = load_year(year)
        valid = df.dropna(subset=['rank', 'mcdm_rank'])
        if len(valid) > 10:
            r, _ = spearmanr(valid['rank'], valid['mcdm_rank'])
            spearman_scores.append(round(r, 4))
        else:
            spearman_scores.append(None)

    avg_spearman = round(np.mean([s for s in spearman_scores if s]), 4)

    return jsonify({
        'total_universities' : int(total_universities),
        'total_countries'    : int(total_countries),
        'years_covered'      : len(YEARS),
        'avg_spearman'       : avg_spearman,
        'spearman_by_year'   : dict(zip(YEARS, spearman_scores))
    })


# ── API: Year-wise ranking ─────────────────
@app.route('/api/ranking/<int:year>')
def ranking(year):
    if year not in YEARS:
        return jsonify({'error': 'Invalid year'}), 400

    df      = load_year(year)
    top_n   = request.args.get('top', 20, type=int)
    country = request.args.get('country', None)

    if country:
        df = df[df['country'].str.lower() == country.lower()]

    df_top = df.nsmallest(top_n, 'mcdm_rank')

    result = []
    for _, row in df_top.iterrows():
        result.append({
            'mcdm_rank'  : int(row['mcdm_rank'])   if pd.notna(row.get('mcdm_rank'))  else None,
            'the_rank'   : int(row['rank'])         if pd.notna(row.get('rank'))       else None,
            'university' : str(row['university']),
            'country'    : str(row['country']),
            'closeness'  : round(float(row['closeness']), 4) if pd.notna(row.get('closeness')) else None,
            'teaching'         : round(float(row['teaching']), 2)      if pd.notna(row.get('teaching'))      else None,
            'research_env'     : round(float(row['research_env']), 2)  if pd.notna(row.get('research_env'))  else None,
            'research_qual'    : round(float(row['research_qual']), 2) if pd.notna(row.get('research_qual')) else None,
            'industry'         : round(float(row['industry']), 2)      if pd.notna(row.get('industry'))      else None,
            'intl_outlook'     : round(float(row['intl_outlook']), 2)  if pd.notna(row.get('intl_outlook'))  else None,
        })

    return jsonify({'year': year, 'data': result})


# ── API: Country list ──────────────────────
@app.route('/api/countries')
def countries():
    all_df = load_all_years()
    country_list = sorted(all_df['country'].dropna().unique().tolist())
    return jsonify({'countries': country_list})


# ── API: Dynamic trend for selected universities ──
@app.route('/api/trend')
def trend():
    universities = request.args.getlist('universities')
    if not universities:
        return jsonify({'error': 'No universities specified'}), 400

    all_df = load_all_years()
    result = {}

    for uni in universities:
        uni_data = all_df[all_df['university'].str.lower() == uni.lower()]
        if uni_data.empty:
            continue
        trend_data = []
        for _, row in uni_data.sort_values('year').iterrows():
            trend_data.append({
                'year'      : int(row['year']),
                'mcdm_rank' : int(row['mcdm_rank'])          if pd.notna(row.get('mcdm_rank'))  else None,
                'the_rank'  : int(row['rank'])                if pd.notna(row.get('rank'))       else None,
                'closeness' : round(float(row['closeness']), 4) if pd.notna(row.get('closeness')) else None,
            })
        result[uni] = trend_data

    return jsonify({'trends': result})


# ── API: University list for search ───────
@app.route('/api/universities')
def universities():
    year    = request.args.get('year', 2021, type=int)
    df      = load_year(year)
    uni_list = sorted(df['university'].dropna().unique().tolist())
    return jsonify({'universities': uni_list})


# ── API: All universities across all years ─
@app.route('/api/universities/all')
def all_universities():
    all_df   = load_all_years()
    uni_list = sorted(all_df['university'].dropna().unique().tolist())
    return jsonify({'universities': uni_list, 'count': len(uni_list)})


# ── API: University deep dive ──────────────
@app.route('/api/university/<path:name>')
def university_detail(name):
    all_df   = load_all_years()
    uni_data = all_df[all_df['university'].str.lower() == name.lower()]

    if uni_data.empty:
        return jsonify({'error': 'University not found'}), 404

    result = []
    for _, row in uni_data.sort_values('year').iterrows():
        result.append({
            'year'         : int(row['year']),
            'mcdm_rank'    : int(row['mcdm_rank'])            if pd.notna(row.get('mcdm_rank'))    else None,
            'the_rank'     : int(row['rank'])                  if pd.notna(row.get('rank'))         else None,
            'closeness'    : round(float(row['closeness']), 4) if pd.notna(row.get('closeness'))    else None,
            'teaching'     : round(float(row['teaching']), 2)  if pd.notna(row.get('teaching'))     else None,
            'research_env' : round(float(row['research_env']), 2)  if pd.notna(row.get('research_env'))  else None,
            'research_qual': round(float(row['research_qual']), 2) if pd.notna(row.get('research_qual')) else None,
            'industry'     : round(float(row['industry']), 2)      if pd.notna(row.get('industry'))      else None,
            'intl_outlook' : round(float(row['intl_outlook']), 2)  if pd.notna(row.get('intl_outlook'))  else None,
        })

    return jsonify({
        'university' : name,
        'country'    : str(uni_data.iloc[0]['country']),
        'data'       : result
    })


# ── API: Biggest movers ────────────────────
@app.route('/api/movers')
def movers():
    all_df   = load_all_years()
    first_yr = all_df[all_df['year'] == 2021][['university', 'mcdm_rank']].rename(columns={'mcdm_rank': 'rank_2021'})
    last_yr  = all_df[all_df['year'] == 2026][['university', 'mcdm_rank', 'country']].rename(columns={'mcdm_rank': 'rank_2026'})

    merged = pd.merge(first_yr, last_yr, on='university').dropna()
    merged['change'] = merged['rank_2021'] - merged['rank_2026']  # positive = improved

    top_risers  = merged.nlargest(10, 'change')[['university', 'country', 'rank_2021', 'rank_2026', 'change']].to_dict('records')
    top_fallers = merged.nsmallest(10, 'change')[['university', 'country', 'rank_2021', 'rank_2026', 'change']].to_dict('records')

    return jsonify({'risers': top_risers, 'fallers': top_fallers})


# ── API: Validation data ───────────────────
@app.route('/api/validation')
def validation():
    result = []
    for year in YEARS:
        df    = load_year(year)
        valid = df.dropna(subset=['rank', 'mcdm_rank'])
        if len(valid) > 10:
            r, p = spearmanr(valid['rank'], valid['mcdm_rank'])
            result.append({
                'year'      : year,
                'spearman_r': round(float(r), 4),
                'p_value'   : round(float(p), 6),
                'n'         : int(len(valid))
            })

    return jsonify({'validation': result})


# ── API: Predict My Rank ───────────────────
@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json()

    year        = int(data.get('year', 2024))
    user_scores = {
        'teaching'     : float(data.get('teaching', 50)),
        'research_env' : float(data.get('research_env', 50)),
        'research_qual': float(data.get('research_qual', 50)),
        'industry'     : float(data.get('industry', 50)),
        'intl_outlook' : float(data.get('intl_outlook', 50)),
    }

    # Load real data and weights
    df      = load_year(year)
    weights = load_weights(year)
    w       = np.array(weights['final_weights'])

    # Add user university as new row
    user_row = pd.DataFrame([{
        'university'   : 'Your University',
        'country'      : 'N/A',
        'rank'         : np.nan,
        **user_scores
    }])
    df_combined = pd.concat([df[['university', 'country', 'rank'] + CRITERIA], user_row], ignore_index=True)

    # Normalize using min-max on combined data
    norm_df = df_combined[CRITERIA].copy()
    for col in CRITERIA:
        col_min = norm_df[col].min()
        col_max = norm_df[col].max()
        if col_max - col_min > 0:
            norm_df[col] = (norm_df[col] - col_min) / (col_max - col_min)
        else:
            norm_df[col] = 0

    # Run TOPSIS
    norm_matrix = norm_df.values
    closeness   = topsis(norm_matrix, w)

    df_combined['closeness'] = closeness
    df_combined['mcdm_rank'] = pd.Series(closeness).rank(ascending=False).astype(int)

    # Get user result
    user_result = df_combined[df_combined['university'] == 'Your University'].iloc[0]
    user_rank   = int(user_result['mcdm_rank'])
    user_close  = round(float(user_result['closeness']), 4)

    # Find 3 nearest universities
    df_real = df_combined[df_combined['university'] != 'Your University'].copy()
    df_real['dist_to_user'] = abs(df_real['mcdm_rank'] - user_rank)
    nearest = df_real.nsmallest(3, 'dist_to_user')[['university', 'country', 'mcdm_rank']].to_dict('records')

    # Percentile
    total        = len(df_combined) - 1
    percentile   = round((1 - user_rank / total) * 100, 1)

    return jsonify({
        'year'       : year,
        'mcdm_rank'  : user_rank,
        'closeness'  : user_close,
        'total'      : total,
        'percentile' : percentile,
        'nearest'    : nearest,
        'scores'     : user_scores
    })


# ─────────────────────────────────────────
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860, debug=False)