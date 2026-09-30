/* ============================================
   KAYOLE DIGITAL HUB — Registration Logic
   Student + Donor with confirmation modal
   Both roles create Supabase auth accounts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('registrationForm');
  const status = document.getElementById('formStatus');
  const roleButtons = document.querySelectorAll('.role-btn');
  const studentFields = document.getElementById('studentFields');
  const donorFields = document.getElementById('donorFields');

  const modal = document.getElementById('confirmModal');
  const modalSummary = document.getElementById('modalSummary');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');

  let currentRole = 'student';
  let pendingSubmission = null;

  if (!form) return;

  /* ---------- 1. ROLE TOGGLE ---------- */
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRole = btn.dataset.role;

      if (currentRole === 'donor') {
        studentFields.style.display = 'none';
        donorFields.style.display = 'block';
        document.getElementById('track').removeAttribute('required');
        document.getElementById('student_password').removeAttribute('required');
        document.getElementById('pledge_type').setAttribute('required', 'required');
        document.getElementById('donor_password').setAttribute('required', 'required');
      } else {
        studentFields.style.display = 'block';
        donorFields.style.display = 'none';
        document.getElementById('track').setAttribute('required', 'required');
        document.getElementById('student_password').setAttribute('required', 'required');
        document.getElementById('pledge_type').removeAttribute('required');
        document.getElementById('donor_password').removeAttribute('required');
      }
    });
  });

  /* ---------- 2. FORM SUBMIT → SHOW MODAL ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    status.className = 'form-status';
    status.textContent = '';
    status.style.display = 'none';

    const fullName = form.full_name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();

    /* ----- STUDENT ----- */
    if (currentRole === 'student') {
      const track = form.track.value;
      const password = form.student_password.value;

      if (!track) {
        status.className = 'form-status error';
        status.textContent = 'Please select a track.';
        return;
      }
      if (!password || password.length < 8) {
        status.className = 'form-status error';
        status.textContent = 'Password must be at least 8 characters.';
        return;
      }

      pendingSubmission = {
        type: 'student',
        password: password,
        fullName: fullName,
        email: email,
        data: {
          full_name: fullName,
          email: email,
          phone: phone || null,
          applicant_type: 'student',
          track: track,
          gender: form.gender.value || null,
          age_range: form.age_range.value || null,
          motivation: form.motivation.value.trim() || null
        }
      };

      modalSummary.innerHTML = `
        <div class="row"><span class="label">Role</span><span class="value">Student</span></div>
        <div class="row"><span class="label">Name</span><span class="value">${escapeHtml(fullName)}</span></div>
        <div class="row"><span class="label">Email</span><span class="value">${escapeHtml(email)}</span></div>
        <div class="row"><span class="label">Phone</span><span class="value">${escapeHtml(phone || '—')}</span></div>
        <div class="row"><span class="label">Track</span><span class="value">${escapeHtml(track)}</span></div>
        <div class="row"><span class="label">Gender</span><span class="value">${escapeHtml(form.gender.value || '—')}</span></div>
        <div class="row"><span class="label">Age Range</span><span class="value">${escapeHtml(form.age_range.value || '—')}</span></div>
      `;
    }

    /* ----- DONOR ----- */
    else {
      const pledgeType = form.pledge_type.value;
      const password = form.donor_password.value;

      if (!pledgeType) {
        status.className = 'form-status error';
        status.textContent = 'Please select a pledge type.';
        return;
      }
      if (!password || password.length < 8) {
        status.className = 'form-status error';
        status.textContent = 'Password must be at least 8 characters.';
        return;
      }

      pendingSubmission = {
        type: 'donor',
        password: password,
        fullName: fullName,
        email: email,
        data: {
          donor_name: fullName,
          donor_email: email,
          donor_phone: phone || null,
          pledge_type: pledgeType,
          amount: form.amount.value ? parseFloat(form.amount.value) : null,
          description: form.description.value.trim() || null
        }
      };

      modalSummary.innerHTML = `
        <div class="row"><span class="label">Role</span><span class="value">Donor</span></div>
        <div class="row"><span class="label">Name</span><span class="value">${escapeHtml(fullName)}</span></div>
        <div class="row"><span class="label">Email</span><span class="value">${escapeHtml(email)}</span></div>
        <div class="row"><span class="label">Phone</span><span class="value">${escapeHtml(phone || '—')}</span></div>
        <div class="row"><span class="label">Pledge Type</span><span class="value">${escapeHtml(pledgeType)}</span></div>
        <div class="row"><span class="label">Amount</span><span class="value">${form.amount.value ? 'KES ' + Number(form.amount.value).toLocaleString() : 'In-kind'}</span></div>
      `;
    }

    modal.style.display = 'flex';
  });

  /* ---------- 3. CANCEL ---------- */
  modalCancel.addEventListener('click', () => {
    modal.style.display = 'none';
    pendingSubmission = null;
  });

  /* ---------- 4. CONFIRM — SEND TO SUPABASE ---------- */
  modalConfirm.addEventListener('click', async () => {
    if (!pendingSubmission) return;

    modal.style.display = 'none';
    status.className = 'form-status';
    status.textContent = 'Submitting...';
    status.style.display = 'block';

    try {
      // Step 1: Create auth account for BOTH roles
      const { error: authError } = await supabaseClient.auth.signUp({
        email: pendingSubmission.email,
        password: pendingSubmission.password,
        options: {
          data: {
            full_name: pendingSubmission.fullName,
            role: pendingSubmission.type
          }
        }
      });

      if (authError && !authError.message.toLowerCase().includes('already')) {
        throw authError;
      }

      // Step 2: Insert the row into the correct table
      if (pendingSubmission.type === 'student') {
        const { error } = await supabaseClient
          .from('applications')
          .insert([pendingSubmission.data]);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from('pledges')
          .insert([pendingSubmission.data]);
        if (error) throw error;
      }

      // Step 3: Sign out so they can log in properly
      await supabaseClient.auth.signOut();

      status.className = 'form-status success';
      status.textContent = 'Submission received. Thank you!';
      form.reset();
      pendingSubmission = null;

      setTimeout(() => {
        window.location.href = 'thankyou.html';
      }, 1500);

    } catch (err) {
      console.error('Submission error:', err);
      status.className = 'form-status error';
      status.textContent = 'Something went wrong: ' + err.message;
    }
  });

  /* ---------- 5. XSS PROTECTION ---------- */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

});