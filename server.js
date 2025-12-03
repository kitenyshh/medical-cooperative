const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// База данных
const db = new sqlite3.Database('medical.db', (err) => {
  if (err) console.error('Ошибка подключения БД:', err);
  else console.log('✅ БД подключена: medical.db');
});

// Инициализация схемы и "пакета" функций
const schemaSql = fs.readFileSync('database.sql', 'utf8');
const functionsSql = fs.readFileSync('functions.sql', 'utf8');

db.exec(schemaSql + '\n' + functionsSql, (err) => {
  if (err) console.error('Ошибка инициализации БД:', err);
  else console.log('✅ Схема и пакет функций созданы');
});

// Простая "сессия"
let currentUser = null;

// ===== АВТОРИЗАЦИЯ / РЕГИСТРАЦИЯ ВРАЧЕЙ =====

app.get('/', (req, res) => {
  res.render('login', { error: null });
});

app.post('/', (req, res) => {
  const { login, password } = req.body;

  db.get('SELECT * FROM doctors WHERE login = ?', [login], (err, doctor) => {
    if (err) {
      console.error(err);
      return res.render('login', { error: 'Ошибка БД' });
    }

    if (!doctor || doctor.password !== password) {
      return res.render('login', { error: 'Неверный логин или пароль' });
    }

    currentUser = doctor;
    res.redirect('/exam');
  });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { login, password, name } = req.body;

  if (!login || !password || !name) {
    return res.render('register', { error: 'Заполните все поля' });
  }

  db.run(
    'INSERT INTO doctors (login, password, name) VALUES (?, ?, ?)',
    [login, password, name],
    (err) => {
      if (err) {
        console.error(err);
        return res.render('register', { error: 'Такой логин уже существует' });
      }
      res.redirect('/');
    }
  );
});

app.get('/logout', (req, res) => {
  currentUser = null;
  res.redirect('/');
});

// ===== ПАЦИЕНТЫ =====

app.get('/patients', (req, res) => {
  if (!currentUser) return res.redirect('/');

  db.all('SELECT * FROM patients', (err, patients) => {
    if (err) {
      console.error(err);
      patients = [];
    }
    res.render('patients_list', { doctor: currentUser, patients });
  });
});

app.get('/patients/new', (req, res) => {
  if (!currentUser) return res.redirect('/');
  res.render('patient_new', { doctor: currentUser, error: null });
});

app.post('/patients/new', (req, res) => {
  if (!currentUser) return res.redirect('/');

  const { name, gender, birth_date, home_address } = req.body;

  if (!name || !gender) {
    return res.render('patient_new', { doctor: currentUser, error: 'Имя и пол обязательны' });
  }

  db.run(
    'INSERT INTO patients (name, gender, birth_date, home_address) VALUES (?, ?, ?, ?)',
    [name, gender, birth_date || null, home_address || null],
    (err) => {
      if (err) {
        console.error(err);
        return res.render('patient_new', { doctor: currentUser, error: 'Ошибка добавления пациента' });
      }
      res.redirect('/exam');
    }
  );
});

app.get('/patients/:id', (req, res) => {
  if (!currentUser) return res.redirect('/');

  const patientId = req.params.id;

  db.get('SELECT * FROM patients WHERE id = ?', [patientId], (err, patient) => {
    if (err || !patient) {
      console.error(err);
      return res.send('Пациент не найден');
    }

    db.all(
      `
      SELECT 
        v.id AS visit_id,
        v.visit_date,
        v.location,
        v.symptoms,
        d.name AS diagnosis_name,
        v.prescription_text,
        GROUP_CONCAT(DISTINCT m.name) AS medicines
      FROM visits v
      LEFT JOIN diagnoses d ON v.diagnosis_id = d.id
      LEFT JOIN prescriptions pr ON pr.visit_id = v.id
      LEFT JOIN medicines m ON pr.medicine_id = m.id
      WHERE v.patient_id = ?
      GROUP BY v.id, v.visit_date, v.location, v.symptoms, d.name, v.prescription_text
      ORDER BY v.visit_date DESC
      `,
      [patientId],
      (err2, visits) => {
        if (err2) {
          console.error(err2);
          visits = [];
        }

        db.all('SELECT * FROM diagnoses', (err3, diagnoses) => {
          if (err3) {
            console.error(err3);
            diagnoses = [];
          }

          res.render('patient_card', {
            doctor: currentUser,
            patient,
            visits,
            diagnoses,
            error: null
          });
        });
      }
    );
  });
});

app.post('/patients/:id/add-diagnosis', (req, res) => {
  if (!currentUser) return res.redirect('/');

  const patientId = req.params.id;
  const { diagnosis_id, symptoms, prescription_text, visit_date, location } = req.body;

  const dateValue = visit_date || new Date().toISOString().split('T')[0];
  const locValue = location || 'Приём';

  db.run(
    'INSERT INTO visits (patient_id, doctor_id, visit_date, location, symptoms, diagnosis_id, prescription_text) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [patientId, currentUser.id, dateValue, locValue, symptoms, diagnosis_id, prescription_text],
    (err) => {
      if (err) {
        console.error(err);
        return res.send('Ошибка добавления заболевания');
      }
      res.redirect(`/patients/${patientId}`);
    }
  );
});

// ===== ДИАГНОЗЫ (СПРАВОЧНИК) =====

// Список диагнозов + форма добавления
app.get('/diagnoses', (req, res) => {
  if (!currentUser) return res.redirect('/');

  db.all('SELECT * FROM diagnoses', (err, diagnoses) => {
    if (err) {
      console.error(err);
      diagnoses = [];
    }
    res.render('diagnoses', { doctor: currentUser, diagnoses, error: null });
  });
});

// Обработка добавления диагноза
app.post('/diagnoses', (req, res) => {
  if (!currentUser) return res.redirect('/');

  const { name, description } = req.body;

  if (!name) {
    db.all('SELECT * FROM diagnoses', (err, diagnoses) => {
      if (err) {
        console.error(err);
        diagnoses = [];
      }
      return res.render('diagnoses', { doctor: currentUser, diagnoses, error: 'Название диагноза обязательно' });
    });
    return;
  }

  db.run(
    'INSERT INTO diagnoses (name, description) VALUES (?, ?)',
    [name, description || null],
    (err) => {
      if (err) {
        console.error(err);
        db.all('SELECT * FROM diagnoses', (err2, diagnoses) => {
          if (err2) {
            console.error(err2);
            diagnoses = [];
          }
          return res.render('diagnoses', { doctor: currentUser, diagnoses, error: 'Такой диагноз уже существует' });
        });
      } else {
        res.redirect('/diagnoses');
      }
    }
  );
});

// ===== ОСМОТРЫ =====

app.get('/exam', (req, res) => {
  if (!currentUser) return res.redirect('/');

  db.all('SELECT * FROM patients', (err, patients) => {
    if (err) return res.send('Ошибка БД (patients)');

    db.all('SELECT * FROM diagnoses', (err2, diagnoses) => {
      if (err2) return res.send('Ошибка БД (diagnoses)');

      db.all('SELECT * FROM medicines', (err3, medicines) => {
        if (err3) return res.send('Ошибка БД (medicines)');

        res.render('exam', {
          doctor: currentUser,
          patients,
          diagnoses,
          medicines
        });
      });
    });
  });
});

app.post('/exam', (req, res) => {
  if (!currentUser) return res.redirect('/');

  const {
    patient_id,
    visit_date,
    location,
    symptoms,
    diagnosis_id,
    prescription_text,
    existing_medicine_id,
    new_med_name,
    new_med_intake,
    new_med_action,
    new_med_side
  } = req.body;

  const dateValue = visit_date || new Date().toISOString().split('T')[0];

  db.run(
    'INSERT INTO visits (patient_id, doctor_id, visit_date, location, symptoms, diagnosis_id, prescription_text) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [patient_id, currentUser.id, dateValue, location, symptoms, diagnosis_id, prescription_text],
    function (err) {
      if (err) {
        console.error(err);
        return res.send('Ошибка сохранения осмотра');
      }

      const visitId = this.lastID;

      if (existing_medicine_id) {
        db.run(
          'INSERT INTO prescriptions (visit_id, medicine_id) VALUES (?, ?)',
          [visitId, existing_medicine_id],
          (err2) => {
            if (err2) console.error('Ошибка назначения лекарства', err2);
          }
        );
      }

      if (new_med_name) {
        db.run(
          'INSERT INTO medicines (name, intake_method, action_description, side_effects) VALUES (?, ?, ?, ?)',
          [new_med_name, new_med_intake, new_med_action, new_med_side],
          function (err3) {
            if (err3) {
              console.error('Ошибка добавления лекарства', err3);
            } else {
              const medId = this.lastID;
              db.run(
                'INSERT INTO prescriptions (visit_id, medicine_id) VALUES (?, ?)',
                [visitId, medId],
                (err4) => {
                  if (err4) console.error('Ошибка назначения нового лекарства', err4);
                }
              );
            }
          }
        );
      }

      res.redirect('/exam');
    }
  );
});

// ===== ОТЧЁТЫ =====

app.get('/reports', (req, res) => {
  if (!currentUser) return res.redirect('/');

  const date = req.query.date || new Date().toISOString().split('T')[0];

  db.all(
    `
    SELECT 
      DATE(v.visit_date) AS date,
      COUNT(*) AS count,
      GROUP_CONCAT(DISTINCT d.name) AS doctors
    FROM visits v
    JOIN doctors d ON v.doctor_id = d.id
    WHERE DATE(v.visit_date) = ?
    GROUP BY DATE(v.visit_date)
    `,
    [date],
    (err, visitsByDate) => {
      if (err) {
        console.error(err);
        visitsByDate = [];
      }

      db.all(
        'SELECT diagnosis_name AS diagnosis, patients_count FROM v_patients_by_diagnosis',
        (err2, byDiagnosis) => {
          if (err2) {
            console.error(err2);
            byDiagnosis = [];
          }

          db.all('SELECT * FROM medicines', (err3, medicines) => {
            if (err3) {
              console.error(err3);
              medicines = [];
            }

            res.render('reports', {
              doctor: currentUser,
              date,
              visitsByDate,
              byDiagnosis,
              medicines
            });
          });
        }
      );
    }
  );
});

app.listen(port, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${port}`);
  console.log(`📱 Логин/пароль: doctor1 / doctor123`);
});
