export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  const data = error?.response?.data;
  const fieldMessages = Array.isArray(data?.errors)
    ? data.errors.map((item) => item?.message).filter(Boolean)
    : [];

  if (fieldMessages.length > 0) {
    return [...new Set(fieldMessages)].join(' ');
  }

  return data?.message || error?.message || fallback;
}
