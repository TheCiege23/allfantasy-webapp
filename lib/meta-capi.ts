import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || '1607977376870461';

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

interface CAPIEventParams {
  eventName: string;
  eventId: string;
  email: string;
  phone?: string;
  clientIp?: string;
  clientUserAgent?: string;
  eventSourceUrl?: string;
  fbp?: string;
  fbc?: string;
}

export async function sendMetaCAPIEvent({
  eventName,
  eventId,
  email,
  phone,
  clientIp,
  clientUserAgent,
  eventSourceUrl,
  fbp,
  fbc,
}: CAPIEventParams): Promise<{ success: boolean; error?: string; meta?: any }> {
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  
  if (!accessToken) {
    console.warn('META_CONVERSIONS_API_TOKEN not set, skipping CAPI event');
    return { success: false, error: 'No access token configured' };
  }

  const eventTime = Math.floor(Date.now() / 1000);

  const userData: Record<string, any> = {};
  
  if (email) userData.em = [sha256(normEmail(email))];
  if (phone) userData.ph = [sha256(normPhone(phone))];
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  const payload: any = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl || 'https://allfantasy.ai/',
        user_data: userData,
        custom_data: {
          currency: 'USD',
          value: 0.00,
        },
      },
    ],
  };

  const testEventCode = process.env.META_TEST_EVENT_CODE;
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${accessToken}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta CAPI error:', result);
      return { success: false, error: result?.error?.message || 'CAPI request failed', meta: result };
    }

    console.log('Meta CAPI event sent:', eventName, eventId);
    return { success: true, meta: result };
  } catch (error: any) {
    console.error('Meta CAPI fetch error:', error);
    return { success: false, error: error?.message || 'Network error' };
  }
}
