/* ============================================
   KAYOLE DIGITAL HUB — Donor Dashboard Logic
   Loads the logged-in donor's pledges
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {

  // 1. Require login
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const email = session.user.email;
  document.getElementById('donorName').textContent = email.split('@')[0];

  // 2. Load pledges matching this donor's email
  const { data: pledges, error } = await supabaseClient
    .from('pledges')
    .select('*')
    .eq('donor_email', email)
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('pledgesList').innerHTML =
      '<p style="color:#a42030;padding:20px;background:#fff;border-radius:12px;">Could not load pledges: ' + error.message + '</p>';
    return;
  }

  // 3. Update stats
  document.getElementById('pledgeCount').textContent = pledges.length;

  const total = pledges.reduce((sum, p) => sum + (p.amount || 0), 0);
  document.getElementById('totalAmount').textContent =
    'KES ' + total.toLocaleString();

  // 4. Render pledges
  if (pledges.length === 0) {
    document.getElementById('pledgesList').innerHTML = `
      <div class="dash-empty" style="background:#fff;border-radius:12px;padding:60px 20px;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <h3>No pledges yet</h3>
        <p>You haven't made any pledges.
          <a href="register.html">Make a pledge here</a>.</p>
      </div>
    `;
  } else {
    document.getElementById('pledgesList').innerHTML = pledges.map(p => `
      <div class="track-card" style="margin-bottom:16px;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 16px rgba(0,0,0,0.08);border-left:5px solid var(--teal);">
        <h3 style="color:var(--navy);margin-bottom:8px;">${escapeHtml(p.pledge_type)}</h3>
        <p style="color:var(--teal-dark);font-size:0.85rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
          ${escapeHtml(p.status || 'pending')}
        </p>
        ${p.description ? `<p style="color:var(--grey-text);">${escapeHtml(p.description)}</p>` : ''}
        <p style="font-size:0.9rem;color:var(--navy);font-weight:600;margin-top:12px;">
          ${p.amount ? 'KES ' + Number(p.amount).toLocaleString() : 'In-kind support'}
        </p>
        <p style="font-size:0.85rem;color:#4a4a6a;margin-top:8px;">
          Submitted: ${new Date(p.created_at).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
          })}
        </p>
      </div>
    `).join('');
  }

  // 5. Logout
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });

  // XSS protection
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

});