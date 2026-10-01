import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
];

function getCredentials() {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!base64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 não configurada");
  }
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: SCOPES,
  });
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: getAuth() });
}

export function getDocsClient() {
  return google.docs({ version: "v1", auth: getAuth() });
}

export function getServiceAccountEmail() {
  return getCredentials().client_email as string;
}
