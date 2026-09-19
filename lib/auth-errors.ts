export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "email 或密碼錯誤";
  }
  if (normalized.includes("user already registered")) {
    return "此 email 已註冊";
  }
  if (normalized.includes("password")) {
    return "密碼不符合要求（至少 6 個字元）";
  }
  return message;
}
