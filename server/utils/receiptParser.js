export const parseReceipt = (text) => {
  const amountMatch = text.match(/₹?\s?\d+(\.\d{1,2})?/g);

  const dateMatch = text.match(
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/
  );

  return {
    merchant: text.split("\n")[0],
    amount: amountMatch?.pop() || null,
    date: dateMatch?.[0] || null,
  };
};