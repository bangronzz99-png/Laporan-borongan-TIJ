
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Silakan login terlebih dahulu');

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`
      }
    });

    if (!authResponse.ok) throw new Error('Sesi login tidak valid');

    const user = await authResponse.json();

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!profileResponse.ok) throw new Error('Gagal memeriksa akun');

    const profiles = await profileResponse.json();

    if (!profiles.length || profiles[0].role !== 'admin') {
      throw new Error('Hanya Admin yang boleh mengirim data');
    }

    const data = JSON.parse(event.body || '{}');

    const url = process.env.GOOGLE_SCRIPT_URL;
    const secret = process.env.GOOGLE_SCRIPT_SECRET;

    if (!url || !secret) throw new Error('Konfigurasi belum lengkap');

    if (!['Harian', 'Mingguan', 'Bulanan', 'Pembayaran'].includes(data.sheet)) {
      throw new Error('Nama sheet tidak valid');
    }

    if (!Array.isArray(data.rows) || !data.rows.length) {
      throw new Error('Data kosong');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        sheet: data.sheet,
        rows: data.rows
      }),
      redirect: 'follow'
    });

    const result = await response.json();

    return {
      statusCode: result.success ? 200 : 400,
      body: JSON.stringify(result)
    };

  } catch (error) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        success: false,
        message: error.message
      })
    };
  }
};
