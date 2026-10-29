export function isDefinitivelyRejectedRequest(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return false;

  const status = (error as { status?: unknown }).status;
  // Only input-validation rejections prove that no order was accepted. Other
  // 4xx responses can include auth failures or a 409 for an existing request.
  return status === 400 || status === 422;
}
