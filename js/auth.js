document.addEventListener('DOMContentLoaded', () => {

  const loginForm = document.getElementById('loginForm');
  const loginStatus = document.getElementById('loginStatus');

  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    loginStatus.className = 'form-status';
    loginStatus.textContent = 'Signing in...';
    loginStatus.style.display = 'block';

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      loginStatus.className = 'form-status error';
      loginStatus.textContent = 'Login failed: ' + error.message;
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      loginStatus.className = 'form-status error';
      loginStatus.textContent = 'Profile error: ' + profileError.message;
      return;
    }

    loginStatus.className = 'form-status success';
    loginStatus.textContent = 'Login successful. Redirecting...';

    if (profile.role === 'admin') {
      window.location.href = 'admin.html';
    } else if (profile.role === 'donor') {
      window.location.href = 'donor-dashboard.html';
    } else if (profile.role === 'staff') {
      window.location.href = 'staff-dashboard.html';
    } else {
      window.location.href = 'student-dashboard.html';
    }

  });

});