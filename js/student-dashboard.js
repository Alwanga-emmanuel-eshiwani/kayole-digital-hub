document.addEventListener('DOMContentLoaded', async () => {

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const email = session.user.email;

  document.getElementById('userName').textContent = email.split('@')[0];

  const { data: apps } = await supabaseClient
    .from('applications')
    .select('*')
    .eq('email', email);

  document.getElementById('applicationCount').textContent = apps?.length || 0;

  if (apps && apps.length > 0) {
    document.getElementById('trackName').textContent = apps[0].track || '—';
    document.getElementById('applicationsList').innerHTML = apps.map(a => `
      <div class="track-card" style="margin-bottom:16px;">
        <h3>${a.track}</h3>
        <p class="track-meta">Submitted: ${new Date(a.created_at).toLocaleDateString()}</p>
        <p>Status: <strong>Pending review</strong></p>
      </div>
    `).join('');
  } else {
    document.getElementById('applicationsList').innerHTML =
      '<p>You have no applications yet. <a href="register.html">Register here</a>.</p>';
  }

  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });

});