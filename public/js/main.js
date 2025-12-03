async function loadReports() {
  const date = document.getElementById('dateFilter').value;
  const url = `/reports?date=${date}`;
  window.location.href = url;
}

// Автообновление отчетов каждые 30 сек (опционально)
setInterval(loadReports, 30000);
