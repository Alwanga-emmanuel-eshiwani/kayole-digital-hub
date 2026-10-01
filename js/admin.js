/* ============================================
   KAYOLE DIGITAL HUB — Admin Dashboard Logic
   Loads students, donors, stats, filters, exports
   and secure status updates.
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
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');
  const statusNotice = document.getElementById('statusNotice');
  const printTitle = document.getElementById('printTitle');
  const printMeta = document.getElementById('printMeta');

  let activeTab = 'students';
  let studentsData = [];
  let donorsData = [];
  let noticeTimer = null;

  function unlockPage() {
    if (typeof window.__adminUnlock === 'function') window.__adminUnlock();
  }

  async function getUserRole(userId) {
    const { data, error } = await supabaseClient.from('profiles').select('role').eq('id', userId).single();
    if (error || !data) return null;
    return data.role;
  }

  async function denyAccess() {
    await supabaseClient.auth.signOut();
    window.location.replace('login.html');
  }

  async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { showLogin(); unlockPage(); return; }
    const role = await getUserRole(session.user.id);
    if (role !== 'admin') { await denyAccess(); return; }
    showDashboard();
    unlockPage();
  }

  function showLogin() {
    loginView.classList.remove('dashboard-hidden');
    dashboardView.classList.add('dashboard-hidden');
  }

  function showDashboard() {
    loginView.classList.add('dashboard-hidden');
    dashboardView.classList.remove('dashboard-hidden');
    loadData();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginStatus.className = 'form-status visible';
    loginStatus.textContent = 'Signing in...';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: loginForm.email.value.trim(), password: loginForm.password.value
    });
    if (error) {
      loginStatus.className = 'form-status error';
      loginStatus.textContent = 'Login failed: ' + error.message;
      return;
    }

    const role = await getUserRole(data.user.id);
    if (role !== 'admin') {
      loginStatus.className = 'form-status error';
      loginStatus.textContent = 'Access denied. This account is not an administrator.';
      await supabaseClient.auth.signOut();
      return;
    }
    loginStatus.className = 'form-status success';
    loginStatus.textContent = 'Signed in successfully.';
    showDashboard();
  });

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    showLogin();
  });

  async function loadData() {
    tableBody.innerHTML = '<tr><td class="dash-loading" colspan="9">Loading records...</td></tr>';
    clearNotice();

    const [students, donors] = await Promise.all([
      supabaseClient.from('applications').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('pledges').select('*').order('created_at', { ascending: false })
    ]);

    if (students.error || donors.error) {
      tableBody.innerHTML = `<tr><td class="dash-loading" colspan="9"><div class="dash-load-error"><strong>Could not load dashboard data.</strong><span>${escapeHtml((students.error || donors.error).message)}</span></div></td></tr>`;
      return;
    }

    studentsData = students.data || [];
    donorsData = donors.data || [];
    statStudents.textContent = studentsData.length;
    statDonors.textContent = donorsData.length;
    const total = donorsData.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    statAmount.textContent = 'KES ' + total.toLocaleString();
    updatePendingCount();
    renderTable();
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      trackFilter.classList.toggle('filter-hidden', activeTab !== 'students');
      if (activeTab !== 'students') trackFilter.value = '';
      renderTable();
    });
  });

  searchInput.addEventListener('input', renderTable);
  trackFilter.addEventListener('change', renderTable);

  function getVisibleRows() {
    const query = searchInput.value.trim().toLowerCase();
    const track = trackFilter.value;

    if (activeTab === 'students') {
      let rows = studentsData.filter(r =>
        !query ||
        (r.full_name || '').toLowerCase().includes(query) ||
        (r.email || '').toLowerCase().includes(query)
      );
      if (track) rows = rows.filter(r => r.track === track);
      return rows;
    }

    return donorsData.filter(r =>
      !query ||
      (r.donor_name || '').toLowerCase().includes(query) ||
      (r.donor_email || '').toLowerCase().includes(query)
    );
  }

  function renderTable() {
    const rows = getVisibleRows();

    if (activeTab === 'students') {
      tableHead.innerHTML = '<tr><th>Date</th><th>Name</th><th>Email</th><th>Phone</th><th>Track</th><th>Gender</th><th>Age</th><th>Status</th><th>Contact</th></tr>';
      if (!rows.length) {
        tableBody.innerHTML = '<tr><td colspan="9"><div class="dash-empty"><h3>No student applications found</h3><p>Applications will appear here as they come in.</p></div></td></tr>';
        updatePrintMeta(0);
        return;
      }

      tableBody.innerHTML = rows.map(r => {
        const status = normalizeStudentStatus(r.status);
        return `<tr>
          ${cell('Date', formatDate(r.created_at))}
          ${cell('Name', escapeHtml(r.full_name))}
          ${cell('Email', escapeHtml(r.email))}
          ${cell('Phone', escapeHtml(r.phone || '—'))}
          ${cell('Track', escapeHtml(r.track || '—'))}
          ${cell('Gender', escapeHtml(r.gender || '—'))}
          ${cell('Age', escapeHtml(r.age_range || '—'))}
          ${cell('Status', statusSelect('applications', r.id, status))}
          ${cell('Contact', contactButtons(r.email, r.phone))}
        </tr>`;
      }).join('');
      updatePrintMeta(rows.length);
      return;
    }

    tableHead.innerHTML = '<tr><th>Date</th><th>Donor Name</th><th>Email</th><th>Phone</th><th>Pledge Type</th><th>Amount</th><th>Status</th><th>Contact</th></tr>';
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="8"><div class="dash-empty"><h3>No donor pledges found</h3><p>Pledges will appear here as they come in.</p></div></td></tr>';
      updatePrintMeta(0);
      return;
    }

    tableBody.innerHTML = rows.map(r => {
      const status = normalizeDonorStatus(r.status);
      const amount = r.amount ? 'KES ' + Number(r.amount).toLocaleString() : 'In-kind';
      return `<tr>
        ${cell('Date', formatDate(r.created_at))}
        ${cell('Donor Name', escapeHtml(r.donor_name))}
        ${cell('Email', escapeHtml(r.donor_email))}
        ${cell('Phone', escapeHtml(r.donor_phone || '—'))}
        ${cell('Pledge Type', escapeHtml(r.pledge_type || '—'))}
        ${cell('Amount', escapeHtml(amount))}
        ${cell('Status', statusSelect('pledges', r.id, status))}
        ${cell('Contact', contactButtons(r.donor_email, r.donor_phone))}
      </tr>`;
    }).join('');
    updatePrintMeta(rows.length);
  }

  function cell(label, content) {
    return `<td data-label="${escapeHtml(label)}">${content}</td>`;
  }

  // Applications use the four database values exactly as defined in Supabase.
  function normalizeStudentStatus(status) {
    const options = ['Pending', 'Approved', 'Completed', 'Rejected'];
    return options.includes(status) ? status : 'Pending';
  }

  function normalizeDonorStatus(status) {
    const options = ['pending', 'confirmed', 'completed', 'rejected'];
    return options.includes(status) ? status : 'pending';
  }

  function statusClass(status) {
    return String(status || '').toLowerCase();
  }

  function statusSelect(table, id, currentStatus) {
    const options = table === 'applications'
      ? ['Pending', 'Approved', 'Completed', 'Rejected']
      : ['pending', 'confirmed', 'completed', 'rejected'];
    const fallback = table === 'applications' ? 'Pending' : 'pending';
    const safeCurrent = options.includes(currentStatus) ? currentStatus : fallback;
    return `<select class="status-select ${statusClass(safeCurrent)}" data-table="${table}" data-id="${escapeHtml(id)}" data-previous="${safeCurrent}" aria-label="Change status">
      ${options.map(status => `<option value="${status}" ${status === safeCurrent ? 'selected' : ''}>${status.charAt(0).toUpperCase() + status.slice(1)}</option>`).join('')}
    </select>`;
  }

  tableBody.addEventListener('change', async (event) => {
    const select = event.target.closest('.status-select');
    if (!select) return;

    const table = select.dataset.table;
    const id = select.dataset.id;
    const newStatus = select.value;
    const previousStatus = select.dataset.previous || newStatus;

    select.disabled = true;
    select.classList.add('saving');
    clearNotice();

    /*
      The select() after update is intentional: Supabase can otherwise report
      no error even when an RLS policy prevents the row from being updated.
      We only update the UI after the database confirms the changed row.
    */
    const { data, error } = await supabaseClient
      .from(table)
      .update({ status: newStatus })
      .eq('id', id)
      .select('id, status')
      .maybeSingle();

    select.disabled = false;
    select.classList.remove('saving');

    if (error || !data) {
      select.value = previousStatus;
      select.dataset.previous = previousStatus;
      select.classList.remove('pending', 'approved', 'confirmed', 'completed', 'rejected');
      select.classList.add(statusClass(previousStatus));

      const message = error
        ? `Status was not saved: ${error.message}`
        : 'Status was not saved because the database did not return an updated record. Check the admin UPDATE policy in Supabase.';
      showNotice(message, 'error');
      return;
    }

    const savedStatus = data.status || newStatus;
    select.value = savedStatus;
    select.dataset.previous = savedStatus;
    select.classList.remove('pending', 'approved', 'confirmed', 'completed', 'rejected');
    select.classList.add(statusClass(savedStatus));

    const collection = table === 'applications' ? studentsData : donorsData;
    const record = collection.find(item => String(item.id) === String(id));
    if (record) record.status = savedStatus;
    updatePendingCount();
    showNotice(`Status updated to ${savedStatus.charAt(0).toUpperCase() + savedStatus.slice(1)}.`, 'success');
  });

  function updatePendingCount() {
    const pending = studentsData.filter(d => !d.status || d.status === 'Pending').length + donorsData.filter(d => !d.status || d.status === 'pending').length;
    statPending.textContent = pending;
  }

  function contactButtons(email, phone) {
    const safeEmail = (email || '').trim();
    const safePhone = (phone || '').replace(/[^0-9]/g, '');
    let html = '<div class="contact-actions">';
    if (safeEmail) html += `<a href="mailto:${encodeURIComponent(safeEmail)}?subject=Kayole%20Digital%20Hub%20%E2%80%94%20Update" class="contact-btn email" title="Send email" aria-label="Send email"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></a>`;
    if (safePhone) html += `<a href="https://wa.me/${safePhone}" target="_blank" rel="noopener" class="contact-btn whatsapp" title="WhatsApp" aria-label="WhatsApp"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.8 11.8 0 0 0 12.1 0C5.55 0 .22 5.33.22 11.9c0 2.1.55 4.15 1.6 5.96L.1 24l6.3-1.65a11.9 11.9 0 0 0 5.7 1.46h.01c6.55 0 11.88-5.34 11.88-11.91a11.84 11.84 0 0 0-3.47-8.42Zm-8.42 18.29h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.88 9.88 0 0 1-1.51-5.24c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.12 1.03 6.98 2.9a9.84 9.84 0 0 1 2.9 7c0 5.45-4.44 9.88-9.88 9.88Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.37.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.08.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z"/></svg></a>`;
    if (!safeEmail && !safePhone) html += '<span class="dash-placeholder">—</span>';
    return html + '</div>';
  }

  exportBtn.addEventListener('click', () => {
    const rows = getVisibleRows();
    const csvRows = activeTab === 'students'
      ? [['Date','Name','Email','Phone','Track','Gender','Age','Status'], ...rows.map(r => [formatDate(r.created_at), r.full_name, r.email, r.phone || '', r.track || '', r.gender || '', r.age_range || '', r.status || 'Pending'])]
      : [['Date','Name','Email','Phone','Pledge Type','Amount','Status'], ...rows.map(r => [formatDate(r.created_at), r.donor_name, r.donor_email, r.donor_phone || '', r.pledge_type || '', r.amount || '', r.status || 'pending'])];

    const csv = csvRows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, activeTab === 'students' ? 'kayole-digital-hub-students.csv' : 'kayole-digital-hub-donors.csv', 'text/csv;charset=utf-8;');
    showNotice(`${rows.length} ${activeTab === 'students' ? 'student applications' : 'donor pledges'} exported to CSV.`, 'success');
  });

  exportPdfBtn.addEventListener('click', () => {
    const rows = getVisibleRows();
    if (!rows.length) {
      showNotice('There are no records to export for the current filters.', 'error');
      return;
    }

    updatePrintMeta(rows.length);
    showNotice('Print dialog opened. Choose “Save as PDF” as the printer to create the PDF.', 'success');
    setTimeout(() => window.print(), 80);
  });

  function updatePrintMeta(count) {
    const label = activeTab === 'students' ? 'Student Applications' : 'Donor Pledges';
    const filterText = searchInput.value.trim() ? `Search: “${searchInput.value.trim()}”` : '';
    const trackText = activeTab === 'students' && trackFilter.value ? `Track: ${trackFilter.value}` : '';
    const filters = [filterText, trackText].filter(Boolean).join(' · ');
    printTitle.textContent = `Kayole Digital Hub — ${label}`;
    printMeta.textContent = `${count} record${count === 1 ? '' : 's'}${filters ? ` · ${filters}` : ''} · Generated ${new Date().toLocaleString('en-GB')}`;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function showNotice(message, type) {
    clearTimeout(noticeTimer);
    statusNotice.textContent = message;
    statusNotice.className = `admin-status-notice ${type} visible`;
    noticeTimer = setTimeout(clearNotice, 7000);
  }

  function clearNotice() {
    if (statusNotice) statusNotice.className = 'admin-status-notice';
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  checkSession();
});
