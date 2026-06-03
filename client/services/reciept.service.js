export const scanReceipt = async (file) => {
  const formData = new FormData();

  formData.append("receipt", file);

  const response = await api.post(
    "/receipts/scan",
    formData
  );

  return response.data;
};