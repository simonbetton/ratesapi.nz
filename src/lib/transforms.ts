export function toTitleFormat(str: string | null) {
  if (!str) {
    return str;
  }

  // Capitalize the first character
  let result = str.charAt(0).toUpperCase();

  for (let i = 1; i < str.length; i++) {
    // If the original character is uppercase, keep it, otherwise convert to lowercase
    result +=
      str.charAt(i) === str.charAt(i).toUpperCase()
        ? str.charAt(i)
        : str.charAt(i).toLowerCase();
  }

  return result;
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
