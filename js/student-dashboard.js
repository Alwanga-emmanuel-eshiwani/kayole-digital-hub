document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const email = session.user.email;
  document.getElementById('userName').textContent = email.split('@')[0];

  const { data: apps, error } = await supabaseClient.from('applications').select('*').eq('email', email).order('created_at', { ascending: false });
  const list = document.getElementById('applicationsList');
  const journeySteps = [...document.querySelectorAll('.journey-step')];

  if (error) {
    list.innerHTML = '<div class="donor-error">Could not load your application details. Please try again later.</div>';
    return;
  }

  const applications = apps || [];
  document.getElementById('applicationCount').textContent = applications.length;

  if (applications.length > 0) {
    const app = applications[0];
    const status = (app.status || 'pending').toLowerCase();
    document.getElementById('trackName').textContent = app.track || '—';
    document.getElementById('statusText').textContent = status.replace(/\b\w/g, c => c.toUpperCase());

    let currentStep = 2;
    if (['confirmed','enrolled'].includes(status)) currentStep = 3;
    if (['completed','learning','active'].includes(status)) currentStep = 4;
    journeySteps.forEach((step, index) => {
      const number = index + 1;
      step.classList.toggle('active', number <= currentStep);
      step.classList.toggle('current', number === currentStep);
    });

    list.innerHTML = applications.map(a => `
      <div class="pledge-card application-card">
        <h3>${escapeHtml(a.track || 'Programme application')}</h3>
        <p class="pledge-status">${escapeHtml(a.status || 'Pending review')}</p>
        <p class="pledge-description">Submitted on ${new Date(a.created_at).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}.</p>
        ${a.motivation ? `<p class="pledge-description">${escapeHtml(a.motivation)}</p>` : ''}
      </div>`).join('');
  } else {
    document.getElementById('trackName').textContent = '—';
    document.getElementById('statusText').textContent = 'Not applied';
    journeySteps.forEach(step => step.classList.remove('active','current'));
    list.innerHTML = '<div class="dash-empty"><h3>No application yet</h3><p>You have no applications yet. <a href="register.html">Register here</a>.</p></div>';
  }

  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault(); await supabaseClient.auth.signOut(); window.location.href = 'index.html';
  });

  function escapeHtml(text) { const div=document.createElement('div'); div.textContent=text==null?'':String(text); return div.innerHTML; }
});
