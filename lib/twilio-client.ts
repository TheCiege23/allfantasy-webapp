import twilio from "twilio"

let cachedCredentials: {
  accountSid: string
  apiKey: string
  apiKeySecret: string
  phoneNumber: string
} | null = null

async function getCredentials() {
  if (cachedCredentials) return cachedCredentials

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null

  if (!xReplitToken) {
    throw new Error("Twilio authentication token not found")
  }

  const res = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=twilio",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  )

  const data = await res.json()
  const connectionSettings = data.items?.[0]

  if (
    !connectionSettings ||
    !connectionSettings.settings.account_sid ||
    !connectionSettings.settings.api_key ||
    !connectionSettings.settings.api_key_secret
  ) {
    throw new Error("Twilio not connected")
  }

  cachedCredentials = {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number,
  }

  return cachedCredentials
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials()
  return twilio(apiKey, apiKeySecret, { accountSid })
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials()
  return phoneNumber
}
