
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');

    const url = process.env.GOOGLE_SCRIPT_URL;
    const secret = process.env.GOOGLE_SCRIPT_SECRET;

    if (!url || !secret) {
      throw new Error('Konfigurasi Google Sheets belum lengkap');
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
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error.message
      })
    };
  }
};
