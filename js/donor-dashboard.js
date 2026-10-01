/* ============================================
   KAYOLE DIGITAL HUB — Donor Dashboard Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const email = session.user.email;
  document.getElementById('donorName').textContent = email.split('@')[0];

  const { data: pledges, error } = await supabaseClient
    .from('pledges').select('*').eq('donor_email', email).order('created_at', { ascending: false });

  const list = document.getElementById('pledgesList');
  if (error) {
    list.innerHTML = '<div class="donor-error">Could not load pledges: ' + escapeHtml(error.message) + '</div>';
    return;
  }

  const records = pledges || [];
  document.getElementById('pledgeCount').textContent = records.length;
  const total = records.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  document.getElementById('totalAmount').textContent = 'KES ' + total.toLocaleString();

  if (!records.length) {
    list.innerHTML = '<div class="dash-empty"><h3>No pledges yet</h3><p>You haven\'t made any pledges. <a href="register.html">Make a pledge here</a>.</p></div>';
  } else {
    list.innerHTML = records.map(p => `
      <div class="pledge-card">
        <h3>${escapeHtml(p.pledge_type || 'Support pledge')}</h3>
        <p class="pledge-status">${escapeHtml(p.status || 'Pending')}</p>
        ${p.description ? `<p class="pledge-description">${escapeHtml(p.description)}</p>` : ''}
        <p class="pledge-amount">${p.amount ? 'KES ' + Number(p.amount).toLocaleString() : 'In-kind support'}</p>
        <p class="pledge-date">Submitted: ${new Date(p.created_at).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</p>
      </div>`).join('');
  }

  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault(); await supabaseClient.auth.signOut(); window.location.href = 'index.html';
  });

  function escapeHtml(text) { const div=document.createElement('div'); div.textContent=text==null?'':String(text); return div.innerHTML; }
});
