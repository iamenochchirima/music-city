export const notificationCatalog = {
  "agreement.proposed": {
    category: "transactional",
    title: "Agreement ready for your approval",
    body: "Review the proposed contributor splits and respond.",
  },
  "agreement.accept": {
    category: "transactional",
    title: "Contributor accepted your agreement",
    body: "A contributor approved the proposed splits. Open the agreement for the latest status.",
  },
  "agreement.reject": {
    category: "transactional",
    title: "Agreement rejected",
    body: "A contributor rejected the proposed splits. Review their response.",
  },
  "agreement.dispute": {
    category: "transactional",
    title: "Agreement disputed",
    body: "A contributor raised a dispute. Review their response before proceeding.",
  },
  "agreement.revision_created": {
    category: "transactional",
    title: "Agreement revision started",
    body: "A new draft is being prepared. You will be notified when it is ready for approval.",
  },
  "agreement.finalized": {
    category: "transactional",
    title: "Agreement finalized",
    body: "The contributor agreement has been confirmed on the network.",
  },
  "release.published": {
    category: "transactional",
    title: "Your release is published",
    body: "Your release is now available to listeners.",
  },
  "upload.ready": {
    category: "transactional",
    title: "Audio processing complete",
    body: "Your audio is ready. Review your release in Studio.",
  },
  "upload.failed": {
    category: "transactional",
    title: "Audio needs attention",
    body: "Audio processing failed. Open Studio to review and retry.",
  },
  "release.failed": {
    category: "transactional",
    title: "Publication needs attention",
    body: "Your release could not be published. Review its details and try again.",
  },
  "earnings.available": {
    category: "transactional",
    title: "Earnings available",
    body: "Your earnings have been funded and are available to claim.",
  },
  "earnings.claimed": {
    category: "transactional",
    title: "Earnings claimed",
    body: "Your earnings withdrawal has been confirmed.",
  },
  "payment.receipt": {
    category: "transactional",
    title: "Payment confirmed",
    body: "Your Music City payment has been confirmed. View your account for purchase and access details.",
  },
  "support.receipt": {
    category: "transactional",
    title: "Support payment confirmed",
    body: "Your direct support payment has been confirmed. View your payment history for details.",
  },
  "support.received": {
    category: "transactional",
    title: "You received direct support",
    body: "A direct support payment to you has been confirmed. View your support history for details.",
  },
  "release.update": {
    category: "releaseNotifications",
    title: "New release",
    body: "An artist you follow has published a release.",
  },
  "artist.update": {
    category: "artistUpdates",
    title: "Artist update",
    body: "There is an update from an artist you follow.",
  },
  "product.update": {
    category: "productUpdates",
    title: "Music City update",
    body: "There is news about Music City.",
  },
} as const;
export type NotificationKind = keyof typeof notificationCatalog;
export function emailAllowed(
  kind: NotificationKind,
  preferences?: Record<string, boolean>,
) {
  const category = notificationCatalog[kind].category;
  return category === "transactional" || preferences?.[category] === true;
}
