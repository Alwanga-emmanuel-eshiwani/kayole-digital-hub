/* ============================================
   KAYOLE DIGITAL HUB — Admin Dashboard Logic
   Loads students, donors, stats, filters, export
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginStatus = document.getElementById('loginStatus');
  const logoutBtn = document.getElementById('logoutBtn');

  const statStudents = document.getElementById('statStudents');
  const statDonors = document.getElementById('statDonors');
  const statAmount = document.getElementById('statAmount');
  const statPending = document.getElementById('statPending');

  const tabs = document.querySelectorAll('.dash-tab');
  const searchInput = document.getElementById('searchInput');
  const trackFilter = document.getElementById('trackFilter');
  const exportBtn = document.getElementById('exportBtn');
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');

  let activeTab = 'students';
  let studentsData = [];
  let donorsData = [];

  /* ---------- 1. SESSION CHECK ---------- */
  async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginView.style.display = 'block';
    dashboardView.style.display = 'none';
  }

  function showDashboard() {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    loadData();
  }

  /* ---------- 2. LOGIN ---------- */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    loginStatus.className = 'form-status';
    loginStatus.textContent = 'Signing in...';
    loginStatus.style.display = 'block';

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: loginForm.email.value.trim(),
      password: loginForm.password.value
    });

    if (error) {
      loginStatus.className = 'form-status error';
      loginStatus.textContent = 'Login failed: ' + error.message;
      return;
    }
    showDashboard();
  });

  /* ---------- 3. LOGOUT ---------- */
  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showLogin();
  });

  /* ---------- 4. LOAD DATA ---------- */
  async function loadData() {
    tableBody.innerHTML = '<tr><td style="text-align:center;padding:24px;color:#4a4a6a;">Loading...</td></tr>';

    const [students, donors] = await Promise.all([
      supabaseClient.from('applications').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('pledges').select('*').order('created_at', { ascending: false })
    ]);

    studentsData = students.data || [];
    donorsData = donors.data || [];

    statStudents.textContent = studentsData.length;
    statDonors.textContent = donorsData.length;

    const total = donorsData.reduce((sum, d) => sum + (d.amount || 0), 0);
    statAmount.textContent = 'KES ' + total.toLocaleString();

    const pending = studentsData.length + donorsData.filter(d => d.status === 'pending').length;
    statPending.textContent = pending;

    renderTable();
  }

  /* ---------- 5. TABS ---------- */
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;

      if (activeTab === 'students') {
        trackFilter.style.display = 'block';
      } else {
        trackFilter.style.display = 'none';
      }
      renderTable();
    });
  });

  /* ---------- 6. FILTERS ---------- */
  searchInput.addEventListener('input', renderTable);
  trackFilter.addEventListener('change', renderTable);

  /* ---------- 7. RENDER TABLE ---------- */
  function renderTable() {
    const query = searchInput.value.trim().toLowerCase();
    const track = trackFilter.value;

    if (activeTab === 'students') {
      tableHead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Track</th>
          <th>Gender</th>
          <th>Age</th>
          <th>Contact</th>
        </tr>`;

      let rows = studentsData;
      if (query) {
        rows = rows.filter(r =>
          (r.full_name || '').toLowerCase().includes(query) ||
          (r.email || '').toLowerCase().includes(query)
        );
      }
      if (track) rows = rows.filter(r => r.track === track);

      if (rows.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="8">
            <div class="dash-empty">
              <h3>No student applications found</h3>
              <p>Applications will appear here as they come in.</p>
            </div>
          </td></tr>`;
        return;
      }

      tableBody.innerHTML = rows.map(r => `
        <tr>
          <td>${formatDate(r.created_at)}</td>
          <td>${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.email)}</td>
          <td>${escapeHtml(r.phone || '—')}</td>
          <td>${escapeHtml(r.track || '—')}</td>
          <td>${escapeHtml(r.gender || '—')}</td>
          <td>${escapeHtml(r.age_range || '—')}</td>
          <td>${contactButtons(r.email, r.phone)}</td>
        </tr>
      `).join('');

    } else {
      tableHead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Donor Name</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Pledge Type</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Contact</th>
        </tr>`;

      let rows = donorsData;
      if (query) {
        rows = rows.filter(r =>
          (r.donor_name || '').toLowerCase().includes(query) ||
          (r.donor_email || '').toLowerCase().includes(query)
        );
      }

      if (rows.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="8">
            <div class="dash-empty">
              <h3>No donor pledges found</h3>
              <p>Pledges will appear here as they come in.</p>
            </div>
          </td></tr>`;
        return;
      }

      tableBody.innerHTML = rows.map(r => `
        <tr>
          <td>${formatDate(r.created_at)}</td>
          <td>${escapeHtml(r.donor_name)}</td>
          <td>${escapeHtml(r.donor_email)}</td>
          <td>${escapeHtml(r.donor_phone || '—')}</td>
          <td>${escapeHtml(r.pledge_type)}</td>
          <td>${r.amount ? 'KES ' + Number(r.amount).toLocaleString() : 'In-kind'}</td>
          <td><span class="status-pill ${escapeHtml(r.status || 'pending')}">${escapeHtml(r.status || 'pending')}</span></td>
          <td>${contactButtons(r.donor_email, r.donor_phone)}</td>
        </tr>
      `).join('');
    }
  }

  /* ---------- 8. CONTACT BUTTONS ---------- */
  function contactButtons(email, phone) {
    const safeEmail = (email || '').trim();
    const safePhone = (phone || '').replace(/[^0-9]/g, '');

    let html = '<div class="contact-actions">';

    if (safeEmail) {
      html += `
        <a href="mailto:${safeEmail}?subject=Kayole%20Digital%20Hub%20—%20Update"
           class="contact-btn email" title="Send email" target="_blank" rel="noopener">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </a>`;
    }

    if (safePhone) {
      html += `
        <a href="https://wa.me/${safePhone}" target="_blank" rel="noopener"
           class="contact-btn whatsapp" title="WhatsApp">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>`;
    }

    if (!safeEmail && !safePhone) {
      html += '<span style="color:#8a8a8a;font-size:0.8rem;">—</span>';
    }

    html += '</div>';
    return html;
  }

  /* ---------- 9. EXPORT CSV ---------- */
  exportBtn.addEventListener('click', () => {
    let rows = [];
    let filename = '';

    if (activeTab === 'students') {
      filename = 'students.csv';
      rows = [
        ['Date', 'Name', 'Email', 'Phone', 'Track', 'Gender', 'Age'],
        ...studentsData.map(r => [
          formatDate(r.created_at), r.full_name, r.email,
          r.phone || '', r.track || '', r.gender || '', r.age_range || ''
        ])
      ];
    } else {
      filename = 'donors.csv';
      rows = [
        ['Date', 'Name', 'Email', 'Phone', 'Pledge Type', 'Amount', 'Status'],
        ...donorsData.map(r => [
          formatDate(r.created_at), r.donor_name, r.donor_email,
          r.donor_phone || '', r.pledge_type, r.amount || '', r.status || 'pending'
        ])
      ];
    }

    const csv = rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  });

  /* ---------- 10. HELPERS ---------- */
  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  /* ---------- 11. START ---------- */
  checkSession();

});