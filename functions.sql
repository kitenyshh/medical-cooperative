-- 1) Количество вызовов по дате
CREATE VIEW v_visits_by_date AS
SELECT
  DATE(visit_date) AS visit_day,
  COUNT(*) AS visit_count
FROM visits
GROUP BY DATE(visit_date);

-- 2) Количество больных с данным диагнозом
CREATE VIEW v_patients_by_diagnosis AS
SELECT
  d.name AS diagnosis_name,
  COUNT(DISTINCT v.patient_id) AS patients_count
FROM visits v
JOIN diagnoses d ON v.diagnosis_id = d.id
GROUP BY d.id, d.name;

-- 3) Побочные эффекты по лекарству
CREATE VIEW v_medicine_effects AS
SELECT
  name AS medicine_name,
  side_effects
FROM medicines;

-- 4) "Процедура" добавления нового лекарства
-- Используется приложением в виде параметризованного запроса:
-- INSERT INTO medicines (name, intake_method, action_description, side_effects)
-- VALUES (:p_name, :p_intake, :p_action, :p_side);
