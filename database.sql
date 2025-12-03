-- ОЧИСТКА
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS medicines;
DROP TABLE IF EXISTS visits;
DROP TABLE IF EXISTS diagnoses;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS doctors;

-- ВРАЧИ
CREATE TABLE doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL
);

-- ПАЦИЕНТЫ
CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT CHECK(gender IN ('М', 'Ж')),
  birth_date DATE,
  home_address TEXT
);

-- ДИАГНОЗЫ
CREATE TABLE diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- ОСМОТРЫ
CREATE TABLE visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  location TEXT CHECK(location IN ('Приём', 'На дому')) NOT NULL,
  symptoms TEXT NOT NULL,
  diagnosis_id INTEGER NOT NULL,
  prescription_text TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id)
);

-- ЛЕКАРСТВА
CREATE TABLE medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  intake_method TEXT NOT NULL,
  action_description TEXT NOT NULL,
  side_effects TEXT NOT NULL
);

-- НАЗНАЧЕНИЯ
CREATE TABLE prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  FOREIGN KEY (visit_id) REFERENCES visits(id),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

-- ТЕСТОВЫЕ ДАННЫЕ

INSERT INTO doctors (login, password, name) VALUES
('doctor1', 'doctor123', 'Иванов И.И.'),
('doctor2', 'doctor456', 'Петров П.П.');

INSERT INTO patients (name, gender, birth_date, home_address) VALUES
('Сидоров А.А.', 'М', '1980-05-15', 'Москва, ул. Ленина, 10'),
('Козлова М.М.', 'Ж', '1990-12-20', 'Москва, ул. Пушкина, 5');

INSERT INTO diagnoses (name, description) VALUES
('Грипп', 'Вирусная инфекция дыхательных путей'),
('ОРВИ', 'Острая респираторная вирусная инфекция');

INSERT INTO medicines (name, intake_method, action_description, side_effects) VALUES
('Парацетамол', '1 табл. 3 раза в день', 'Жаропонижающее и болеутоляющее', 'Тошнота, аллергические реакции'),
('Аспирин', '1 табл. 2 раза в день', 'Противовоспалительное средство', 'Раздражение желудка, кровоточивость');
