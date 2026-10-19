"""
MaternaCare AI — Standalone Web Application Server
"""

from __future__ import annotations

from pathlib import Path
from flask import Flask, jsonify, render_template, request, send_from_directory

from main import (
    CLASS_ORDER,
    FEATURE_COLUMNS,
    FIGURES_DIR,
    get_model_performance_details,
    get_or_create_model,
    predict_risk,
)

BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)

print("Initializing trained model for MaternaCare AI...")
model_payload = get_or_create_model()
trained_model = model_payload["model"] if model_payload else None
model_name = model_payload.get("model_name", "Random Forest") if model_payload else "Random Forest"
print(f"Model ready: {model_name}")


# =============================================================================
# Clinical Context Knowledge Base (Evidence-Based Associations)
# =============================================================================

CLINICAL_CONTEXT_KB = {
    "Age": {
        "thresholds": [
            {"min": 35, "max": 39, "level": "info", "condition": "Advanced Maternal Age (AMA)",
             "associations": [
                 "Increased risk of chromosomal anomalies (e.g., Trisomy 21: ~1:350 at age 35)",
                 "Higher rates of spontaneous miscarriage and stillbirth",
                 "Increased likelihood of gestational diabetes and hypertensive disorders",
                 "May require enhanced prenatal screening (NIPT, detailed anatomy scan)"
             ],
             "guidelines": [
                 "ACOG Practice Bulletin #226: Offer prenatal genetic screening to all pregnant patients regardless of age",
                 "RCOG Green-top Guideline No. 31: Consider additional surveillance for AMA"
             ]},
            {"min": 40, "max": 100, "level": "warning", "condition": "Very Advanced Maternal Age (≥40)",
             "associations": [
                 "Significantly increased chromosomal anomaly risk (Trisomy 21: ~1:100 at age 40)",
                 "Higher rates of preterm birth, low birth weight, and stillbirth",
                 "Strongly associated with gestational diabetes, hypertensive disorders, placental abruption",
                 "Increased cesarean delivery rates"
             ],
             "guidelines": [
                 "ACOG: Consider offering induction at 39 weeks for age ≥40",
                 "Enhanced fetal surveillance (NST/BPP) typically initiated at 36-37 weeks"
             ]},
            {"min": 10, "max": 17, "level": "warning", "condition": "Adolescent Pregnancy (≤17 years)",
             "associations": [
                 "Higher rates of preterm birth, low birth weight, neonatal mortality",
                 "Increased risk of preeclampsia, anemia, postpartum depression",
                 "Social determinants: interrupted education, socioeconomic challenges"
             ],
             "guidelines": [
                 "WHO: Adolescent-friendly antenatal care with psychosocial support",
                 "ACOG: Enhanced screening for STIs, nutritional counseling, mental health"
             ]}
        ]
    },
    "SystolicBP": {
        "thresholds": [
            {"min": 130, "max": 139, "level": "warning", "condition": "Elevated / Stage 1 Hypertension (Systolic 130-139)",
             "associations": [
                 "May indicate early gestational hypertension or chronic hypertension",
                 "Associated with progression to preeclampsia (especially if diastolic ≥80)",
                 "Increased risk of placental abruption, IUGR, preterm delivery"
             ],
             "guidelines": [
                 "ACOG Practice Bulletin #203: Diagnose gestational hypertension at ≥140/90 on 2 occasions ≥4hrs apart",
                 "ISSHP: Consider low-dose aspirin prophylaxis if additional risk factors present"
             ]},
            {"min": 140, "max": 159, "level": "high", "condition": "Stage 2 Hypertension (Systolic 140-159)",
             "associations": [
                 "Meets diagnostic threshold for gestational hypertension / preeclampsia",
                 "If with proteinuria → preeclampsia; without → gestational hypertension",
                 "Risk of maternal end-organ damage, eclampsia, HELLP syndrome"
             ],
             "guidelines": [
                 "ACOG: Initiate antihypertensive therapy at ≥160/110 (acute) or ≥140/90 (chronic)",
                 "ISSHP: Target BP <140/90 in pregnancy; labetalol/nifedipine/methyldopa first-line"
             ]},
            {"min": 160, "max": 220, "level": "high", "condition": "Severe Hypertension (Systolic ≥160)",
             "associations": [
                 "Obstetric emergency: risk of intracranial hemorrhage, eclampsia, placental abruption",
                 "Requires urgent antihypertensive treatment (IV labetalol, hydralazine, nifedipine)",
                 "Consider magnesium sulfate for seizure prophylaxis if preeclampsia diagnosed"
             ],
             "guidelines": [
                 "ACOG: Treat acutely to reduce SBP <160 and DBP <110 within 60 minutes",
                 "WHO: Magnesium sulfate for severe preeclampsia/eclampsia prevention"
             ]}
        ]
    },
    "DiastolicBP": {
        "thresholds": [
            {"min": 80, "max": 89, "level": "warning", "condition": "Elevated / Stage 1 Hypertension (Diastolic 80-89)",
             "associations": [
                 "Often co-occurs with elevated systolic; similar clinical implications",
                 "Diastolic ≥90 is specific for gestational hypertension diagnosis",
                 "May reflect increased peripheral vascular resistance"
             ],
             "guidelines": [
                 "ACOG: Hypertension in pregnancy defined as SBP ≥140 OR DBP ≥90",
                 "Monitor for progression; assess for proteinuria, symptoms"
             ]},
            {"min": 90, "max": 109, "level": "high", "condition": "Stage 2 Hypertension (Diastolic 90-109)",
             "associations": [
                 "Meets diastolic criterion for gestational hypertension / preeclampsia",
                 "Associated with uteroplacental insufficiency, IUGR"
             ],
             "guidelines": [
                 "ACOG: Initiate antihypertensives at persistent DBP ≥90 (or ≥100 per some guidelines)",
                 "Close maternal-fetal surveillance"
             ]},
            {"min": 110, "max": 150, "level": "high", "condition": "Severe Hypertension (Diastolic ≥110)",
             "associations": [
                 "Obstetric emergency: high risk of stroke, eclampsia, placental abruption",
                 "Requires immediate treatment and often delivery if ≥34 weeks"
             ],
             "guidelines": [
                 "ACOG: Acute treatment target DBP <110; magnesium sulfate for seizure prophylaxis"
             ]}
        ]
    },
    "BS": {
        "thresholds": [
            {"min": 7.8, "max": 11.0, "level": "warning", "condition": "Impaired Glucose Tolerance / Elevated (BS 7.8-11.0 mmol/L)",
             "associations": [
                 "Exceeds normal fasting glucose (≤5.6) and 2hr post-load (≤7.8) thresholds",
                 "Suggests gestational diabetes mellitus (GDM) or pre-existing diabetes",
                 "Associated with macrosomia, neonatal hypoglycemia, shoulder dystocia, stillbirth"
             ],
             "guidelines": [
                 "ADA/IADPSG: GDM diagnosed if fasting ≥5.1, 1hr ≥10.0, OR 2hr ≥8.5 mmol/L (75g OGTT)",
                 "Carpenter-Coustan (2-step): 1hr 50g screen ≥7.8 → 3hr 100g OGTT"
             ]},
            {"min": 11.1, "max": 30.0, "level": "high", "condition": "Diabetes Range Hyperglycemia (BS ≥11.1 mmol/L)",
             "associations": [
                 "Meets diagnostic threshold for overt diabetes in pregnancy (fasting ≥7.0 or random ≥11.1)",
                 "High risk of congenital anomalies (if pre-existing), macrosomia, polyhydramnios, stillbirth",
                 "Neonatal complications: hypoglycemia, respiratory distress, hyperbilirubinemia"
             ],
             "guidelines": [
                 "ADA: Target fasting <5.3, 1hr postprandial <7.8, 2hr <6.7 mmol/L in GDM",
                 "Insulin therapy if lifestyle modification insufficient; metformin as alternative"
             ]}
        ]
    },
    "BodyTemp": {
        "thresholds": [
            {"min": 99.1, "max": 100.3, "level": "warning", "condition": "Low-Grade Fever (99.1-100.3°F / 37.3-37.9°C)",
             "associations": [
                 "May indicate intrauterine infection (chorioamnionitis), UTI, or viral illness",
                 "In labor: maternal fever → neonatal sepsis workup, antibiotics",
                 "Associated with fetal tachycardia, increased metabolic demand"
             ],
             "guidelines": [
                 "ACOG: Intrapartum fever ≥38.0°C (100.4°F) → consider chorioamnionitis, broad-spectrum antibiotics",
                 "Evaluate for UTI, respiratory infection, COVID-19"
             ]},
            {"min": 100.4, "max": 106.0, "level": "high", "condition": "Fever (≥100.4°F / ≥38.0°C)",
             "associations": [
                 "Chorioamnionitis until proven otherwise in laboring patients",
                 "Risk of neonatal sepsis, cerebral palsy (if intrauterine inflammation)",
                 "Maternal risks: sepsis, endometritis, wound infection"
             ],
             "guidelines": [
                 "ACOG: Intraamniotic infection diagnosis = maternal fever + ≥1: fetal tachycardia, maternal leukocytosis, purulent amniotic fluid",
                 "Immediate broad-spectrum antibiotics (ampicillin + gentamicin ± clindamycin)"
             ]}
        ]
    },
    "HeartRate": {
        "thresholds": [
            {"min": 100, "max": 119, "level": "warning", "condition": "Tachycardia (HR 100-119 bpm)",
             "associations": [
                 "Physiologic in pregnancy (resting HR increases 10-20 bpm by 3rd trimester)",
                 "Pathologic: anemia, hyperthyroidism, sepsis, hemorrhage, pulmonary embolism",
                 "May indicate pain, anxiety, dehydration, or medication effect (beta-agonists)"
             ],
             "guidelines": [
                 "ACOG: Evaluate new-onset tachycardia for infection, anemia, thyroid, cardiac, PE",
                 "HR >120 at rest warrants urgent assessment"
             ]},
            {"min": 120, "max": 160, "level": "high", "condition": "Significant Tachycardia (HR ≥120 bpm)",
             "associations": [
                 "Red flag for sepsis, hemorrhage, pulmonary embolism, thyrotoxicosis, cardiac arrhythmia",
                 "In pregnancy: consider amniotic fluid embolism, postpartum hemorrhage"
             ],
             "guidelines": [
                 "ACOG: HR >120 + hypotension → activate massive transfusion protocol if bleeding",
                 "RCOG: Sepsis screening (qSOFA) if HR >120 + altered mentation + RR ≥22"
             ]}
        ]
    }
}

DISCLAIMER_TEXT = (
    "⚠️ IMPORTANT DISCLAIMER: This clinical context is for EDUCATIONAL PURPOSES ONLY. "
    "It summarizes evidence-based associations from obstetric literature and guidelines "
    "(ACOG, RCOG, WHO, ADA, ISSHP). It does NOT constitute medical advice, diagnosis, "
    "or treatment recommendations. Individual patient care requires comprehensive clinical "
    "assessment by a qualified healthcare professional. The MaternaCare AI model predicts "
    "dataset-defined risk categories (low/mid/high) from the UCI repository — these are "
    "NOT clinical diagnoses."
)


def get_clinical_context(values: dict) -> dict:
    """Generate evidence-based clinical context for given biomarker values."""
    findings = []
    
    for feature, value in values.items():
        if feature not in CLINICAL_CONTEXT_KB:
            continue
        
        for threshold in CLINICAL_CONTEXT_KB[feature]["thresholds"]:
            if threshold["min"] <= value <= threshold["max"]:
                findings.append({
                    "biomarker": feature,
                    "value": value,
                    "condition": threshold["condition"],
                    "level": threshold["level"],
                    "associations": threshold["associations"],
                    "guidelines": threshold["guidelines"]
                })
                break  # Only match the most specific threshold
    
    # Sort by severity: high > warning > info
    severity_order = {"high": 0, "warning": 1, "info": 2}
    findings.sort(key=lambda x: severity_order.get(x["level"], 3))
    
    return {
        "findings": findings,
        "disclaimer": DISCLAIMER_TEXT,
        "summary": {
            "total_flags": len(findings),
            "high_count": sum(1 for f in findings if f["level"] == "high"),
            "warning_count": sum(1 for f in findings if f["level"] == "warning"),
            "info_count": sum(1 for f in findings if f["level"] == "info")
        }
    }


@app.route("/api/clinical-context", methods=["POST"])
def api_clinical_context():
    """Return evidence-based clinical context for the provided biomarker values."""
    data = request.get_json(silent=True) or {}
    values = {}
    missing = []
    invalid = []
    
    for col in FEATURE_COLUMNS:
        raw_val = data.get(col)
        if raw_val is None or str(raw_val).strip() == "":
            missing.append(col)
            continue
        try:
            values[col] = float(raw_val)
        except (ValueError, TypeError):
            invalid.append(col)
    
    if missing:
        return jsonify({"success": False, "error": f"Missing inputs: {', '.join(missing)}"}), 400
    if invalid:
        return jsonify({"success": False, "error": f"Invalid numeric values: {', '.join(invalid)}"}), 400
    
    context = get_clinical_context(values)
    return jsonify({"success": True, "data": context})


@app.route("/")
def index():
    """Render the main clinical risk dashboard."""
    return render_template(
        "index.html",
        model_name=model_name,
        feature_columns=FEATURE_COLUMNS,
    )


@app.route("/api/predict", methods=["POST"])
def api_predict():
    """Predict risk level and return probabilities based on 6 inputs."""
    if not trained_model:
        return jsonify({"success": False, "error": "Model not available"}), 500

    data = request.get_json(silent=True) or {}
    values = {}
    missing = []
    invalid = []

    for col in FEATURE_COLUMNS:
        raw_val = data.get(col)
        if raw_val is None or str(raw_val).strip() == "":
            missing.append(col)
            continue
        try:
            values[col] = float(raw_val)
        except (ValueError, TypeError):
            invalid.append(col)

    if missing:
        return jsonify({"success": False, "error": f"Missing inputs: {', '.join(missing)}"}), 400
    if invalid:
        return jsonify({"success": False, "error": f"Invalid numeric values: {', '.join(invalid)}"}), 400

    if values["SystolicBP"] < values["DiastolicBP"]:
        return jsonify({"success": False, "error": "SystolicBP must be greater than or equal to DiastolicBP."}), 400
    if values["Age"] < 5 or values["Age"] > 100:
        return jsonify({"success": False, "error": "Age should reasonably be between 10 and 80 years."}), 400
    if values["BS"] <= 0:
        return jsonify({"success": False, "error": "Blood sugar (BS) must be a positive value."}), 400

    result = predict_risk(trained_model, values)
    pred_label = result["predicted_label"]
    probabilities = result.get("probabilities") or {}

    flags = []
    if values["BS"] >= 11.0:
        flags.append({"type": "high", "text": f"Severe Hyperglycemia: BS is {values['BS']} mmol/L (≥ 11.0 mmol/L)"})
    elif values["BS"] >= 7.8:
        flags.append({"type": "warning", "text": f"Elevated Blood Glucose: BS is {values['BS']} mmol/L (normal: < 7.8)"})

    if values["SystolicBP"] >= 140 or values["DiastolicBP"] >= 90:
        flags.append({"type": "high", "text": f"Stage 2 Hypertension: {values['SystolicBP']:.0f}/{values['DiastolicBP']:.0f} mmHg"})
    elif values["SystolicBP"] >= 130 or values["DiastolicBP"] >= 80:
        flags.append({"type": "warning", "text": f"Elevated / Stage 1 BP: {values['SystolicBP']:.0f}/{values['DiastolicBP']:.0f} mmHg"})

    if values["Age"] >= 35:
        flags.append({"type": "info", "text": f"Advanced Maternal Age: {values['Age']:.0f} years (≥ 35 years)"})

    if values["HeartRate"] > 100:
        flags.append({"type": "warning", "text": f"Tachycardia: Resting Heart Rate {values['HeartRate']:.0f} bpm (> 100 bpm)"})

    return jsonify({
        "success": True,
        "prediction": pred_label,
        "probabilities": probabilities,
        "flags": flags,
        "values": values,
    })


@app.route("/api/performance", methods=["GET"])
def api_performance():
    """Return model performance details, confusion matrices, and comparisons."""
    try:
        details = get_model_performance_details()
        return jsonify({"success": True, "data": details})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/figures/<path:filename>")
def serve_figure(filename):
    """Serve the generated model evaluation and confusion matrix plots."""
    figures_folder = BASE_DIR / "figures"
    return send_from_directory(str(figures_folder), filename)


if __name__ == "__main__":
    port = 5000
    print("\n=======================================================")
    print(f"MaternaCare AI Web App running at: http://127.0.0.1:{port}")
    print("=======================================================\n")
    app.run(host="0.0.0.0", port=port, debug=False)
