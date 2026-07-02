import { Router } from "express";

import { adminRouter } from "../modules/admin/admin.router.js";
import { archivesRouter } from "../modules/archives/archives.router.js";
import { authRouter } from "../modules/auth/auth.router.js";
import { entitlementsRouter } from "../modules/entitlements/entitlements.router.js";
import { healthRouter } from "../modules/health/health.router.js";
import { mediaRouter } from "../modules/media/media.router.js";
import { paymentsRouter } from "../modules/payments/payments.router.js";
import { playbackRouter } from "../modules/playback/playback.router.js";
import { releasesRouter } from "../modules/releases/releases.router.js";
import { royaltiesRouter } from "../modules/royalties/royalties.router.js";
import { subscriptionsRouter } from "../modules/subscriptions/subscriptions.router.js";
import { tracksRouter } from "../modules/tracks/tracks.router.js";
import { uploadsRouter } from "../modules/uploads/uploads.router.js";
import { usersRouter } from "../modules/users/users.router.js";
import { walletRouter } from "../modules/wallet/wallet.router.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/archives", archivesRouter);
apiRouter.use("/entitlements", entitlementsRouter);
apiRouter.use("/playback", playbackRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/releases", releasesRouter);
apiRouter.use("/royalties", royaltiesRouter);
apiRouter.use("/subscriptions", subscriptionsRouter);
apiRouter.use("/tracks", tracksRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/wallet", walletRouter);

export { apiRouter };
